"""Lee el consecutivo de facturas (una hoja por mes, 2008 en adelante) y lo
convierte a JSON para scripts/historical-invoices/import.mjs.

Requiere xlrd (python -m pip install --user xlrd).
Uso: python -P scripts/historical-invoices/parse_workbook.py <archivo.xls> <salida.json>

Reglas: se omiten subtotales (SEMANAL/REAL) y filas resumen (cliente vacio o
numerico); "cancelada" en cualquier celda marca la factura como cancelada; si
la fecha viene vacia o con otro anio se usa el mes de la hoja (dateFixed).
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

import xlrd

MONTHS = {
    "ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12,
}


def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip()


def sheet_period(name, title):
    """Year/month from the sheet name (ENE26, enero08, NOVIEMBRE 16, MAY020...)."""
    up = norm(name).upper().replace(" ", "")
    m = re.match(r"([A-Z]+)0?(\d{2,4})$", up)
    month = None
    if m:
        word, yy = m.group(1), m.group(2)
        for k, v in MONTHS.items():
            if word.startswith(k):
                month = v
                break
        y = int(yy)
        year = y if y > 1000 else 2000 + y
        if month:
            return year, month
    t = norm(title).upper()
    ym = re.search(r"(20\d\d)", t)
    for k, v in MONTHS.items():
        if k in t:
            month = v
            break
    return (int(ym.group(1)) if ym else None), month


def to_num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("$", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def invoice_id(v):
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    return norm(v).upper().replace(" ", "")


def main(path, out):
    wb = xlrd.open_workbook(path, on_demand=True)
    rows = []
    stats = defaultdict(Counter)
    for name in wb.sheet_names():
        sh = wb.sheet_by_name(name)
        if sh.nrows < 3:
            continue
        title = sh.cell_value(0, 1) if sh.ncols > 1 else ""
        year, month = sheet_period(name, title)
        header = [norm(sh.cell_value(1, c)).upper() for c in range(sh.ncols)]

        def col(*names):
            for n in names:
                if n in header:
                    return header.index(n)
            return None

        c_inv, c_amt, c_date, c_client = 1, 2, 3, 4
        c_vend = col("VEND")
        c_resale = col("VENTAS")  # 2021-24: monto de reventa cuando MONTO va vacio
        c_order = col("ORDEN COMSA", "COTIZACION", "COT.")
        c_desc = col("DESCRIPCION")
        c_po = col("PO")
        c_mo = col("MO")
        max_r = min(sh.nrows, 2000)
        for r in range(2, max_r):
            raw_inv = sh.cell_value(r, c_inv)
            client = norm(sh.cell_value(r, c_client)) if sh.ncols > c_client else ""
            if raw_inv in ("", None):
                continue
            inv = invoice_id(raw_inv)
            amt = to_num(sh.cell_value(r, c_amt))
            resale = to_num(sh.cell_value(r, c_resale)) if c_resale is not None else None
            # filas de numeracion al final (1,2,3... sin cliente ni monto)
            if not client and not amt and not resale:
                continue
            # subtotales (SEMANAL, REAL, ENERO "refacturado"...: folio sin numero) y filas
            # resumen (cliente numerico o vacio)
            if not re.search(r"\d", inv) or not client or to_num(client) is not None:
                stats[year or 0]["skippedSummary"] += 1
                continue
            flag = norm(sh.cell_value(r, 0)).lower()
            texts = " ".join(norm(sh.cell_value(r, c)).lower() for c in range(sh.ncols) if isinstance(sh.cell_value(r, c), str))
            cancelled = "cancelad" in texts or "cancelad" in client.lower()
            replaces = None
            m = re.search(r"(?:reemplaza|sustituye)\D{0,20}(\w+)", texts)
            if m and "factura" in texts:
                replaces = m.group(1).upper()
            dv = sh.cell_value(r, c_date)
            date = None
            date_fixed = False
            if isinstance(dv, float) and dv > 20000:
                try:
                    d = xlrd.xldate.xldate_as_datetime(dv, wb.datemode).date()
                    date = d.isoformat()
                except Exception:
                    date = None
            if year and month:
                if not date or int(date[:4]) != year or abs(int(date[5:7]) - month) > 1 and not (month in (1, 12)):
                    date = f"{year:04d}-{month:02d}-01" if not date else f"{year:04d}-{month:02d}-{min(int(date[8:10]), 28):02d}"
                    date_fixed = True
            amount = amt if amt else (resale or 0.0)
            series = re.match(r"[A-Z]*", inv).group(0) or "NUM"
            rows.append({
                "sheet": name,
                "period": f"{year:04d}-{month:02d}" if year and month else None,
                "invoice": inv,
                "series": series,
                "amount": round(amount or 0.0, 2),
                "isResale": bool(not amt and resale) or flag == "ventas",
                "date": date,
                "dateFixed": date_fixed,
                "client": client,
                "seller": norm(sh.cell_value(r, c_vend)).lower() if c_vend is not None else "",
                "order": norm(sh.cell_value(r, c_order)) if c_order is not None else "",
                "description": norm(sh.cell_value(r, c_desc)) if c_desc is not None else "",
                "po": invoice_id(sh.cell_value(r, c_po)) if c_po is not None and sh.cell_value(r, c_po) not in ("", None) else "",
                "laborAmount": to_num(sh.cell_value(r, c_mo)) if c_mo is not None else None,
                "flag": flag,
                "cancelled": cancelled,
                "replaces": replaces,
            })
            y = (year or 0)
            stats[y]["rows"] += 1
            stats[y]["cancelled"] += cancelled
            stats[y]["dateFixed"] += date_fixed
            stats[y]["zero"] += (not amount)
    json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    tot = defaultdict(float)
    for r in rows:
        if not r["cancelled"]:
            tot[r["period"][:4] if r["period"] else "?"] += r["amount"]
    print("filas", len(rows))
    for y in sorted(stats):
        print(y, dict(stats[y]), "total $%.0f" % tot.get(str(y), 0))
    print("series", Counter(r["series"] for r in rows).most_common(12))
    print("flags", Counter(r["flag"] for r in rows if r["flag"]).most_common(15))
    print("sellers", Counter(r["seller"] for r in rows if r["seller"]).most_common(25))
    dup = Counter((r["invoice"]) for r in rows)
    print("facturas repetidas", sum(1 for k, v in dup.items() if v > 1), [k for k, v in dup.most_common(8) if v > 1])
    print("clientes distintos", len(set(r["client"].lower() for r in rows)))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
