import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { jsonOk } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { buildHistory, rankWithShare } from "./history-calc";

const VIEW_PERMISSIONS = ["kpis.view", "sales.view_team"];
const LINK_PERMISSIONS = ["sales.edit_invoice", "kpis.correct_data"];
const KNOWN_SERIES = ["NUM", "F", "L"];

function readFilters(url) {
  const sp = url.searchParams;
  const raw = (sp.get("series") || "NUM,F,L,OTHER").split(",").filter(Boolean);
  return {
    series: raw.filter((s) => KNOWN_SERIES.includes(s)),
    otherSeries: raw.includes("OTHER"),
    includeResale: sp.get("resale") !== "0",
    includeErp: sp.get("erp") !== "0",
  };
}

/**
 * Fuente unificada: historico (sin canceladas y sin las facturas que ya estan
 * capturadas en el ERP, para no duplicar) + facturas del ERP.
 */
function unifiedSource(f) {
  const seriesCond = f.otherSeries
    ? Prisma.sql`(h.series = ANY(${f.series}::text[]) OR NOT (h.series = ANY(${KNOWN_SERIES}::text[])))`
    : Prisma.sql`h.series = ANY(${f.series}::text[])`;
  const erp = f.includeErp && f.series.includes("NUM")
    ? Prisma.sql`
      UNION ALL
      SELECT s.invoice_date AS d, s.net_amount AS amt,
             COALESCE(c.commercial_name, '(sin cliente)') AS client,
             COALESCE(u.name, '(sin vendedor)') AS seller,
             'ERP' AS src
      FROM sales_invoices s
      LEFT JOIN clients c ON c.id = s.client_id
      LEFT JOIN users u ON u.id = s.seller_id
      WHERE s.deleted_at IS NULL`
    : Prisma.empty;
  return Prisma.sql`
    SELECT h.invoice_date AS d, h.amount AS amt,
           COALESCE(c.commercial_name, INITCAP(LOWER(BTRIM(h.client_name)))) AS client,
           COALESCE(u.name, NULLIF(INITCAP(h.seller_alias), ''), '(sin vendedor)') AS seller,
           'HIST' AS src
    FROM historical_invoices h
    LEFT JOIN clients c ON c.id = h.client_id
    LEFT JOIN users u ON u.id = h.seller_id
    WHERE NOT h.cancelled
      AND ${seriesCond}
      ${f.includeResale ? Prisma.empty : Prisma.sql`AND NOT h.is_resale`}
      ${f.includeErp ? Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM sales_invoices s
        WHERE s.deleted_at IS NULL
          AND s.invoice_number = h.invoice_number
          AND EXTRACT(YEAR FROM s.invoice_date) = h.year
      )` : Prisma.empty}
    ${erp}`;
}

const toNum = (v) => (v == null ? 0 : Number(v));

async function groupedBy(source, field, year) {
  const rows = await prisma.$queryRaw`
    SELECT ${Prisma.raw(field)} AS name, SUM(amt) AS total, COUNT(*)::int AS count
    FROM (${source}) u
    WHERE EXTRACT(YEAR FROM d) = ${year}
    GROUP BY 1`;
  return rows.map((r) => ({ name: r.name, total: toNum(r.total), count: r.count }));
}

/** Resumen: anios, matriz mensual y rankings del anio elegido. */
export async function getSalesHistorySummary(request) {
  await requireAnyPermission(VIEW_PERMISSIONS);
  const url = new URL(request.url);
  const f = readFilters(url);
  if (!f.series.length && !f.otherSeries) throw new ValidationError("Selecciona al menos una serie");
  const source = unifiedSource(f);

  const monthRows = await prisma.$queryRaw`
    SELECT TO_CHAR(d, 'YYYY-MM') AS ym, SUM(amt) AS total, COUNT(*)::int AS count
    FROM (${source}) u
    GROUP BY 1 ORDER BY 1`;
  const history = buildHistory(monthRows.map((r) => ({ ym: r.ym, total: toNum(r.total), count: r.count })));
  const years = history.years.map((y) => y.year);
  const lastYear = years[years.length - 1] || new Date().getUTCFullYear();
  const year = Number(url.searchParams.get("year")) || lastYear;

  const [clientsNow, clientsPrev, sellersNow, sellersPrev, meta] = await Promise.all([
    groupedBy(source, "client", year),
    groupedBy(source, "client", year - 1),
    groupedBy(source, "seller", year),
    groupedBy(source, "seller", year - 1),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS rows,
             COUNT(*) FILTER (WHERE quote_id IS NOT NULL)::int AS linked,
             COUNT(*) FILTER (WHERE client_id IS NULL)::int AS without_client,
             COUNT(*) FILTER (WHERE cancelled)::int AS cancelled,
             MIN(invoice_date) AS first_date, MAX(invoice_date) AS last_date
      FROM historical_invoices`,
  ]);

  return jsonOk({
    filters: f,
    year,
    years: history.years,
    topClients: rankWithShare(clientsNow, clientsPrev, 15),
    clientCount: clientsNow.length,
    sellers: rankWithShare(sellersNow, sellersPrev, 30),
    meta: meta[0],
  });
}

/** Listado paginado del historico con filtros. */
export async function listSalesHistory(request) {
  await requireAnyPermission(VIEW_PERMISSIONS);
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(sp.get("pageSize")) || 50));
  const year = Number(sp.get("year")) || null;
  const month = Number(sp.get("month")) || null;
  const q = (sp.get("q") || "").trim();
  const linked = sp.get("linked");

  const where = {
    ...(year
      ? {
          invoiceDate: {
            gte: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
            lt: new Date(Date.UTC(month ? year : year + 1, month ? month : 0, 1)),
          },
        }
      : {}),
    ...(linked === "1" ? { quoteId: { not: null } } : linked === "0" ? { quoteId: null } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { clientName: { contains: q, mode: "insensitive" } },
            { client: { commercialName: { contains: q, mode: "insensitive" } } },
            { description: { contains: q, mode: "insensitive" } },
            { poNumber: { contains: q, mode: "insensitive" } },
            { sellerAlias: { contains: q, mode: "insensitive" } },
            { quote: { folio: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.historicalInvoice.count({ where }),
    prisma.historicalInvoice.findMany({
      where,
      include: {
        client: { select: { id: true, commercialName: true } },
        seller: { select: { id: true, name: true } },
        quote: { select: { id: true, folio: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return jsonOk({ data: rows, total, page, pageSize });
}

const normPo = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Cotizaciones sugeridas para ligar: mismo PO y, si no, cotizaciones del mismo
 * cliente en los 12 meses previos con total parecido al monto facturado.
 */
export async function suggestQuotesForHistory(request, id) {
  await requireAnyPermission(LINK_PERMISSIONS);
  const inv = await prisma.historicalInvoice.findUnique({ where: { id } });
  if (!inv) throw new NotFoundError("Factura no encontrada");
  const select = {
    id: true,
    folio: true,
    total: true,
    currency: true,
    purchaseOrder: true,
    elaborationDate: true,
    status: true,
    client: { select: { commercialName: true } },
  };
  const out = [];
  const po = normPo(inv.poNumber);
  if (po.length >= 4) {
    const byPo = await prisma.$queryRaw`
      SELECT id FROM quotes
      WHERE deleted_at IS NULL AND regexp_replace(UPPER(COALESCE(purchase_order, '')), '[^A-Z0-9]', '', 'g') = ${po}
      LIMIT 10`;
    if (byPo.length) {
      const qs = await prisma.quote.findMany({ where: { id: { in: byPo.map((r) => r.id) } }, select });
      out.push(...qs.map((q) => ({ ...q, reason: "Mismo PO" })));
    }
  }
  if (inv.clientId) {
    const from = new Date(inv.invoiceDate);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    const qs = await prisma.quote.findMany({
      where: {
        deletedAt: null,
        clientId: inv.clientId,
        elaborationDate: { gte: from, lte: inv.invoiceDate },
        id: { notIn: out.map((q) => q.id) },
      },
      select,
      orderBy: { elaborationDate: "desc" },
      take: 60,
    });
    const amount = Number(inv.amount) || 0;
    qs.sort((a, b) => Math.abs(Number(a.total) - amount) - Math.abs(Number(b.total) - amount));
    out.push(...qs.slice(0, 10).map((q) => ({ ...q, reason: "Mismo cliente, monto parecido" })));
  }
  return jsonOk({ data: out });
}

/** Ligar (quoteId) o desligar (null) una factura historica a una cotizacion. */
export async function linkHistoryQuote(request, id) {
  await requireAnyPermission(LINK_PERMISSIONS);
  const actor = await getActor(request);
  const body = await request.json();
  const quoteId = body?.quoteId || null;
  const inv = await prisma.historicalInvoice.findUnique({ where: { id } });
  if (!inv) throw new NotFoundError("Factura no encontrada");
  let clientId = inv.clientId;
  if (quoteId) {
    const quote = await prisma.quote.findFirst({ where: { id: quoteId, deletedAt: null }, select: { id: true, clientId: true } });
    if (!quote) throw new NotFoundError("Cotización no encontrada");
    clientId = clientId || quote.clientId;
  }
  const record = await prisma.historicalInvoice.update({
    where: { id },
    data: {
      quoteId,
      clientId,
      linkMethod: quoteId ? "MANUAL" : null,
      linkedAt: quoteId ? new Date() : null,
      linkedBy: quoteId ? actor.id : null,
    },
    include: { quote: { select: { id: true, folio: true } }, client: { select: { id: true, commercialName: true } } },
  });
  await recordAudit({
    actor,
    module: "sales",
    entity: "HistoricalInvoice",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { quoteId: inv.quoteId, linkMethod: inv.linkMethod },
    newData: { quoteId, linkMethod: record.linkMethod },
  });
  return jsonOk(record);
}
