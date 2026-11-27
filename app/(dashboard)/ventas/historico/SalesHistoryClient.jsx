"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Search, Unlink } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Pagination } from "@/components/tables/Pagination";
import { ChartCard, ColumnChart, HBarChart, SimpleTable, Stat, Tabs, compactMoney } from "@/components/kpis/ui";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { MONTH_LABELS } from "@/domains/sales/history-calc";
import { cn } from "@/lib/utils/cn";

const SERIES = [
  { key: "NUM", label: "Consecutivo COMSA" },
  { key: "F", label: "Serie F" },
  { key: "L", label: "Serie L" },
  { key: "OTHER", label: "Otras" },
];

function Pct({ value, className }) {
  if (value == null) return <span className={cn("text-content-muted", className)}>—</span>;
  const up = value >= 0;
  return (
    <span className={cn("tabular-nums", up ? "text-success-700" : "text-danger-700", className)}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Filters({ filters, onChange }) {
  const toggle = (key) => {
    const next = filters.series.includes(key)
      ? filters.series.filter((s) => s !== key)
      : [...filters.series, key];
    if (next.length) onChange({ ...filters, series: next });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {SERIES.map((s) => (
        <label key={s.key} className="flex items-center gap-1.5">
          <input type="checkbox" checked={filters.series.includes(s.key)} onChange={() => toggle(s.key)} />
          {s.label}
        </label>
      ))}
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={filters.resale}
          onChange={(e) => onChange({ ...filters, resale: e.target.checked })}
        />
        Incluir reventa de material
      </label>
    </div>
  );
}

function SummaryView({ data, year, onYear, onOpenMonth }) {
  const [matrixMode, setMatrixMode] = useState("amount");
  const years = data.years;
  const current = years.find((y) => y.year === year) || years[years.length - 1];
  const prev = years.find((y) => y.year === current?.year - 1);
  if (!current) return <p className="text-sm text-content-muted">Sin datos.</p>;

  const yearBars = years.map((y) => ({
    key: y.year,
    label: String(y.year).slice(2),
    value: y.total,
    muted: y.year !== current.year,
    display: formatMoney(y.total),
    detail: y.partial
      ? `Parcial (${y.ytdMonths} meses) · ${y.ytdGrowthPct == null ? "—" : `${y.ytdGrowthPct}%`} vs mismos meses`
      : `${y.growthPct == null ? "—" : `${y.growthPct}%`} vs año anterior · ${y.count} facturas`,
  }));

  const monthBars = current.months.map((m, i) => ({
    key: m.month,
    label: MONTH_LABELS[i],
    value: m.total,
    display: formatMoney(m.total),
    detail: `${prev ? `${formatMoney(prev.months[i].total)} en ${prev.year}` : ""}${
      m.yoyPct == null ? "" : ` · ${m.yoyPct}%`
    }`,
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <Stat
            label={current.partial ? `Vendido ${current.year} (a ${MONTH_LABELS[current.ytdMonths - 1]})` : `Vendido ${current.year}`}
            value={formatMoney(current.total)}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label={current.partial ? `vs mismos meses ${current.year - 1}` : `vs ${current.year - 1}`}
            value={<Pct value={current.partial ? current.ytdGrowthPct : current.growthPct} />}
            hint={prev ? `${formatMoney(prev.total)} en ${prev.year}` : undefined}
          />
        </Card>
        <Card className="p-4">
          <Stat label="Facturas" value={current.count.toLocaleString("es-MX")} hint={`${data.clientCount} clientes`} />
        </Card>
        <Card className="p-4">
          <Stat label="Ticket promedio" value={formatMoney(current.avgTicket)} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Ventas por año"
          description="Con IVA. Clic en un año para ver su detalle."
          table={
            <SimpleTable
              dense
              rowKey={(r) => r.year}
              rows={[...years].reverse()}
              columns={[
                { key: "year", header: "Año", render: (r) => `${r.year}${r.partial ? " *" : ""}` },
                { key: "total", header: "Total", align: "right", render: (r) => formatMoney(r.total) },
                { key: "g", header: "Crecimiento", align: "right", render: (r) => <Pct value={r.partial ? r.ytdGrowthPct : r.growthPct} /> },
                { key: "count", header: "Facturas", align: "right" },
              ]}
            />
          }
        >
          <ColumnChart bars={yearBars} formatValue={compactMoney} />
          <div className="mt-3 flex flex-wrap gap-1">
            {[...years].reverse().map((y) => (
              <button
                key={y.year}
                type="button"
                onClick={() => onYear(y.year)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs",
                  y.year === current.year ? "bg-brand-600 text-white" : "bg-surface-muted text-content-muted hover:text-content"
                )}
              >
                {y.year}
              </button>
            ))}
          </div>
        </ChartCard>
        <ChartCard title={`Ventas por mes ${current.year}`} description={prev ? `El detalle compara contra ${prev.year}` : undefined}>
          <ColumnChart bars={monthBars} formatValue={compactMoney} />
        </ChartCard>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">Mes contra mes</h3>
            <p className="text-xs text-content-muted">Clic en un mes para ver sus facturas.</p>
          </div>
          <Tabs
            tabs={[
              { key: "amount", label: "Monto" },
              { key: "yoy", label: "% vs año anterior" },
              { key: "mom", label: "% vs mes anterior" },
            ]}
            value={matrixMode}
            onChange={setMatrixMode}
          />
        </div>
        <div className="overflow-x-auto p-3">
          <table className="min-w-full text-xs tabular-nums">
            <thead>
              <tr className="text-content-muted">
                <th className="px-2 py-1 text-left">Año</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-2 py-1 text-right">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-1 text-right">Total</th>
                <th className="px-2 py-1 text-right">Δ año</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...years].reverse().map((y) => (
                <tr key={y.year} className={y.year === current.year ? "bg-brand-50/50" : ""}>
                  <td className="px-2 py-1 font-medium">{y.year}</td>
                  {y.months.map((m) => (
                    <td key={m.month} className="px-1 py-0.5 text-right">
                      <button
                        type="button"
                        className="w-full rounded px-1 py-0.5 text-right hover:bg-surface-muted"
                        onClick={() => onOpenMonth(y.year, m.month)}
                      >
                        {matrixMode === "amount" ? (
                          m.total ? compactMoney(m.total) : "—"
                        ) : (
                          <Pct value={matrixMode === "yoy" ? m.yoyPct : m.momPct} />
                        )}
                      </button>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-medium">{compactMoney(y.total)}</td>
                  <td className="px-2 py-1 text-right">
                    <Pct value={y.partial ? y.ytdGrowthPct : y.growthPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-content-muted">
            * Año en curso: el crecimiento se compara contra los mismos meses del año anterior.
          </p>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title={`Principales clientes ${current.year}`}
          description="Participación y variación contra el año anterior"
          table={
            <SimpleTable
              dense
              rowKey={(r) => r.name}
              rows={data.topClients}
              columns={[
                { key: "name", header: "Cliente" },
                { key: "total", header: "Vendido", align: "right", render: (r) => formatMoney(r.total) },
                { key: "share", header: "%", align: "right", render: (r) => `${r.sharePct}%` },
                { key: "g", header: "vs año ant.", align: "right", render: (r) => <Pct value={r.growthPct} /> },
              ]}
            />
          }
        >
          <HBarChart
            rows={data.topClients.map((r) => ({
              key: r.name,
              label: r.name,
              value: r.total,
              display: `${compactMoney(r.total)} · ${r.sharePct}%`,
              detail: `${r.count} facturas · ${r.growthPct == null ? "nuevo" : `${r.growthPct}% vs año anterior`}`,
            }))}
          />
        </ChartCard>
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Vendedores {current.year}</h3>
            <p className="text-xs text-content-muted">Como se capturó en el consecutivo o el vendedor del ERP</p>
          </div>
          <div className="p-3">
            <SimpleTable
              dense
              rowKey={(r) => r.name}
              rows={data.sellers}
              columns={[
                { key: "name", header: "Vendedor" },
                { key: "total", header: "Vendido", align: "right", render: (r) => formatMoney(r.total) },
                { key: "count", header: "Facturas", align: "right" },
                { key: "share", header: "%", align: "right", render: (r) => `${r.sharePct}%` },
                { key: "g", header: "vs año ant.", align: "right", render: (r) => <Pct value={r.growthPct} /> },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function LinkQuoteModal({ invoice, onClose, onSaved }) {
  const [suggestions, setSuggestions] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoice) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setQ("");
    setResults([]);
    setError("");
    api
      .get(`/api/ventas/historico/${invoice.id}/sugerencias`)
      .then((res) => setSuggestions(res?.data || []))
      .catch(() => setSuggestions([]));
  }, [invoice]);

  async function search() {
    try {
      const res = await api.get(`/api/cotizaciones${toQuery({ q, pageSize: 15, sort: "createdAt", order: "desc", forLink: "1" })}`);
      setResults(res?.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function link(quoteId) {
    setBusy(true);
    setError("");
    try {
      const saved = await api.put(`/api/ventas/historico/${invoice.id}/cotizacion`, { quoteId });
      onSaved(saved);
    } catch (err) {
      setError(err.message || "No se pudo ligar");
    } finally {
      setBusy(false);
    }
  }

  const QuoteRow = ({ quote, reason }) => (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="font-medium">{quote.folio}</span> · {quote.client?.commercialName || ""}
        <span className="block text-xs text-content-muted">
          {formatDate(quote.elaborationDate)} · {formatMoney(quote.total, quote.currency || "MXN")}
          {quote.purchaseOrder ? ` · PO ${quote.purchaseOrder}` : ""}
          {reason ? ` · ${reason}` : ""}
        </span>
      </span>
      <Button size="sm" variant="subtle" loading={busy} onClick={() => link(quote.id)}>
        Ligar
      </Button>
    </li>
  );

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={busy ? undefined : onClose}
      title={`Ligar factura ${invoice?.invoiceNumber || ""} a cotización`}
      description={
        invoice
          ? `${invoice.client?.commercialName || invoice.clientName} · ${formatDate(invoice.invoiceDate)} · ${formatMoney(invoice.amount)}${
              invoice.poNumber ? ` · PO ${invoice.poNumber}` : ""
            }`
          : ""
      }
      size="lg"
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {invoice?.quote && (
          <div className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
            <span>
              Ligada a <span className="font-medium">{invoice.quote.folio}</span>
            </span>
            <Button size="sm" variant="ghost" loading={busy} onClick={() => link(null)}>
              <Unlink className="h-4 w-4" />
              Desligar
            </Button>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">Sugerencias</p>
          {suggestions.length ? (
            <ul className="divide-y divide-border rounded border border-border">
              {suggestions.map((s) => (
                <QuoteRow key={s.id} quote={s} reason={s.reason} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-content-muted">Sin sugerencias por PO o cliente. Busca la cotización.</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={q}
              placeholder="Folio, cliente o PO…"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
            />
            <Button variant="secondary" onClick={search} aria-label="Buscar cotización">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded border border-border">
              {results.map((r) => (
                <QuoteRow key={r.id} quote={r} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InvoicesView({ filtersFromSummary, canLink }) {
  const { toast } = useToast();
  const [params, setParams] = useState({ year: "", month: "", q: "", linked: "", page: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    if (filtersFromSummary) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setParams((p) => ({ ...p, ...filtersFromSummary, page: 1 }));
    }
  }, [filtersFromSummary]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await api.get(
          `/api/ventas/historico${toQuery({
            year: params.year || undefined,
            month: params.month || undefined,
            q: params.q || undefined,
            linked: params.linked || undefined,
            page: params.page,
            pageSize: 50,
          })}`
        )
      );
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const [qDraft, setQDraft] = useState("");
  const set = (patch) => setParams((p) => ({ ...p, ...patch, page: 1 }));

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-2 border-b border-border px-5 py-3">
        <Input
          className="w-56!"
          placeholder="Factura, cliente, PO, descripción…"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && set({ q: qDraft })}
        />
        <Input className="w-24!" type="number" placeholder="Año" value={params.year} onChange={(e) => set({ year: e.target.value })} />
        <Select className="w-28!" value={params.month} onChange={(e) => set({ month: e.target.value })} aria-label="Mes">
          <option value="">Todo el año</option>
          {MONTH_LABELS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select className="w-44!" value={params.linked} onChange={(e) => set({ linked: e.target.value })} aria-label="Liga a cotización">
          <option value="">Con y sin cotización</option>
          <option value="1">Ligadas a cotización</option>
          <option value="0">Sin cotización</option>
        </Select>
        <Button size="sm" variant="secondary" onClick={() => set({ q: qDraft })}>
          Buscar
        </Button>
      </div>
      <div className="p-3 sm:p-5">
        {loading && !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <SimpleTable
              dense
              rows={data?.data || []}
              empty="Sin facturas con esos filtros."
              columns={[
                { key: "invoiceNumber", header: "Factura", render: (r) => <span className="font-medium">{r.invoiceNumber}</span> },
                {
                  key: "date",
                  header: "Fecha",
                  render: (r) => (
                    <span title={r.dateEstimated ? "Fecha estimada con el mes de la hoja" : undefined}>
                      {formatDate(r.invoiceDate)}
                      {r.dateEstimated ? " *" : ""}
                    </span>
                  ),
                },
                {
                  key: "client",
                  header: "Cliente",
                  className: "max-w-[14rem]",
                  render: (r) => (
                    <span className="block truncate" title={r.clientName}>
                      {r.client?.commercialName || r.clientName}
                    </span>
                  ),
                },
                { key: "seller", header: "Vendedor", render: (r) => r.seller?.name || r.sellerAlias || "—" },
                {
                  key: "amount",
                  header: "Monto",
                  align: "right",
                  render: (r) =>
                    r.cancelled ? <Badge tone="neutral">Cancelada</Badge> : formatMoney(r.amount),
                },
                {
                  key: "desc",
                  header: "Descripción",
                  className: "min-w-[12rem] max-w-[18rem]",
                  render: (r) => (
                    <span className="line-clamp-2" title={r.description || ""}>
                      {r.description || "—"}
                      {r.isResale && <Badge tone="warning" className="ml-1">Reventa</Badge>}
                      {r.series !== "NUM" && <Badge className="ml-1">Serie {r.series}</Badge>}
                    </span>
                  ),
                },
                { key: "po", header: "PO", render: (r) => r.poNumber || "—" },
                {
                  key: "quote",
                  header: "Cotización",
                  render: (r) => (
                    <span className="flex items-center gap-1">
                      {r.quote ? (
                        <Link href={`/cotizaciones/${r.quote.id}`} className="text-brand-700 hover:underline">
                          {r.quote.folio}
                        </Link>
                      ) : (
                        <span className="text-content-muted">—</span>
                      )}
                      {r.linkMethod === "PO_AUTO" && <span className="text-[10px] text-content-muted">(PO)</span>}
                      {canLink && (
                        <Button size="sm" variant="ghost" onClick={() => setLinking(r)} aria-label="Ligar a cotización">
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
            />
            {data && (
              <Pagination
                pagination={{
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  totalPages: Math.ceil(data.total / data.pageSize),
                }}
                loading={loading}
                onPageChange={(page) => setParams((p) => ({ ...p, page }))}
              />
            )}
          </>
        )}
      </div>
      <LinkQuoteModal
        invoice={linking}
        onClose={() => setLinking(null)}
        onSaved={() => {
          setLinking(null);
          toast({ variant: "success", title: "Liga actualizada" });
          load();
        }}
      />
    </Card>
  );
}

export default function SalesHistoryClient({ canLink = false }) {
  const [tab, setTab] = useState("resumen");
  const [filters, setFilters] = useState({ series: ["NUM", "F", "L", "OTHER"], resale: true });
  const [year, setYear] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [invoiceFilter, setInvoiceFilter] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `/api/ventas/historico/resumen${toQuery({
          series: filters.series.join(","),
          resale: filters.resale ? "1" : "0",
          year: year || undefined,
        })}`
      );
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar el histórico");
    } finally {
      setLoading(false);
    }
  }, [filters, year]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const meta = data?.meta;
  const description = useMemo(
    () =>
      meta
        ? `${Number(meta.rows).toLocaleString("es-MX")} facturas del consecutivo (${String(meta.first_date).slice(0, 4)}–${String(meta.last_date).slice(0, 4)}) más las capturadas en el ERP, sin duplicar. ${Number(meta.linked).toLocaleString("es-MX")} ligadas a cotización.`
        : "Ventas históricas del consecutivo de facturas y del ERP.",
    [meta]
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Histórico de ventas" description={description} />
      <Card className="px-5 py-3">
        <Filters filters={filters} onChange={setFilters} />
      </Card>
      <Tabs
        tabs={[
          { key: "resumen", label: "Resumen" },
          { key: "facturas", label: "Facturas" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {tab === "resumen" ? (
        loading && !data ? (
          <Skeleton className="h-96 w-full" />
        ) : data ? (
          <SummaryView
            data={data}
            year={data.year}
            onYear={setYear}
            onOpenMonth={(y, m) => {
              setInvoiceFilter({ year: String(y), month: String(m) });
              setTab("facturas");
            }}
          />
        ) : null
      ) : (
        <InvoicesView filtersFromSummary={invoiceFilter} canLink={canLink} />
      )}
    </div>
  );
}
