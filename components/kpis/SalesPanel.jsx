"use client";

import { useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { formatMoney } from "@/lib/utils/format";
import { formatDayShort } from "@/domains/kpis/periods";
import { ChartCard, ColumnChart, DeltaBadge, ProgressBar, SimpleTable, Stat, compactMoney, formatPct } from "./ui";
import { usePanelData } from "./usePanelData";

const GRANULARITY_LABELS = {
  MONTHLY: "mensual",
  QUARTERLY: "trimestral",
  SEMIANNUAL: "semestral",
  ANNUAL: "anual",
};

/** KPI 2 — Proyeccion y avance de ventas (meta vs facturado). */
export function SalesPanel({ params }) {
  const { has } = usePermissions();
  const { data, loading, error } = usePanelData("/api/kpis/ventas", params);
  const [tax, setTax] = useState("with");

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (loading && !data) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  const w = tax === "with";
  const goalKey = w ? "goalWithTax" : "goalWithoutTax";
  const billedKey = w ? "billedWithTax" : "billedWithoutTax";
  const t = data.total;

  const columns = [
    {
      key: "label",
      header: "Vendedor / equipo",
      render: (r) => (
        <div>
          <p className={r.unassigned ? "italic text-content-muted" : "font-medium"}>{r.label}</p>
          {r.prorated && (
            <p className="text-xs text-content-muted">Meta {GRANULARITY_LABELS[r.granularity]} prorrateada al periodo</p>
          )}
        </div>
      ),
    },
    { key: "goal", header: `Meta ${w ? "c/IVA" : "s/IVA"}`, align: "right", render: (r) => formatMoney(r[goalKey]) },
    { key: "billed", header: `Facturado ${w ? "c/IVA" : "s/IVA"}`, align: "right", render: (r) => formatMoney(r[billedKey]) },
    {
      key: "progress",
      header: "Avance",
      className: "min-w-[9rem]",
      render: (r) =>
        r.percent == null ? (
          <span className="text-content-muted">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <ProgressBar percent={r.percent} className="flex-1" label={`Avance ${r.label}`} />
            <span className="w-14 text-right text-sm tabular-nums">{formatPct(r.percent)}</span>
          </div>
        ),
    },
    {
      key: "difference",
      header: "Diferencia",
      align: "right",
      render: (r) => {
        const diff = w ? r.differenceWithTax : r.billedWithoutTax - r.goalWithoutTax;
        return (
          <span className={diff < 0 ? "text-danger-700" : "text-success-700"}>
            {diff > 0 ? "+" : ""}
            {formatMoney(diff)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid flex-1 gap-4 sm:grid-cols-4">
            <Stat label={`Meta ${w ? "(c/IVA)" : "(s/IVA)"}`} value={formatMoney(t[goalKey])} />
            <Stat label={`Facturado ${w ? "(c/IVA)" : "(s/IVA)"}`} value={formatMoney(t[billedKey])}>
              <DeltaBadge delta={data.compare} format="money" />
            </Stat>
            <Stat label="Avance" value={formatPct(t.percent)} tone={t.percent >= 100 ? "success" : "default"} />
            <Stat
              label="Diferencia contra meta"
              value={formatMoney(w ? t.differenceWithTax : t.billedWithoutTax - t.goalWithoutTax)}
              tone={t.differenceWithTax < 0 ? "danger" : "success"}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-[var(--radius-sm)] border border-border p-0.5" role="group" aria-label="IVA">
              {[
                ["with", "Con IVA"],
                ["without", "Sin IVA"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTax(k)}
                  aria-pressed={tax === k}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${tax === k ? "bg-brand-600 text-white" : "text-content-muted hover:bg-surface-muted"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {has("sales.manage_goals") && (
              <Button as={Link} href="/ventas/metas" size="sm" variant="secondary">
                <Target className="h-4 w-4" />
                Metas
              </Button>
            )}
          </div>
        </div>
        <ProgressBar percent={t.percent} className="mt-4 h-3" label="Avance total de la meta" />
        <p className="mt-2 text-xs text-content-muted">
          IVA {data.taxRate}% · Facturación acumulada / meta × 100 · Periodo anterior ({data.previous.label}):{" "}
          {formatMoney(data.previous.total?.billedWithTax)} c/IVA
        </p>
      </Card>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Avance por vendedor / equipo</h3>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            columns={columns}
            rows={data.rows}
            rowKey={(r) => r.key}
            empty="No hay metas ni facturas en el periodo. Configura metas en Ventas → Metas."
            footer={
              data.rows.length ? (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-2 py-2">Total</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatMoney(t[goalKey])}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatMoney(t[billedKey])}</td>
                    <td className="px-2 py-2 tabular-nums">{formatPct(t.percent)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatMoney(w ? t.differenceWithTax : t.billedWithoutTax - t.goalWithoutTax)}
                    </td>
                  </tr>
                </tfoot>
              ) : null
            }
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Facturación acumulada"
          description={`Por ${data.groupBy === "week" ? "semana" : "mes"} · meta del periodo ${formatMoney(t.goalWithTax)} c/IVA`}
          table={
            <SimpleTable
              dense
              rowKey={(r) => r.key}
              columns={[
                { key: "label", header: data.groupBy === "week" ? "Semana" : "Mes" },
                { key: "amount", header: "Facturado", align: "right", render: (r) => formatMoney(r.amount) },
                { key: "cumulative", header: "Acumulado", align: "right", render: (r) => formatMoney(r.cumulative) },
              ]}
              rows={data.cumulative}
            />
          }
        >
          <ColumnChart
            bars={data.cumulative.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.cumulative,
              display: formatMoney(b.cumulative),
              detail: `En el ${data.groupBy === "week" ? "periodo semanal" : "mes"}: ${formatMoney(b.amount)}`,
            }))}
            formatValue={compactMoney}
          />
        </ChartCard>

        <ChartCard title="Facturas del periodo por vendedor" description="Monto con IVA">
          <SimpleTable
            dense
            rowKey={(r) => r.sellerId}
            columns={[
              { key: "sellerName", header: "Vendedor" },
              { key: "count", header: "Facturas", align: "right" },
              { key: "amount", header: "Monto", align: "right", render: (r) => formatMoney(r.amount) },
            ]}
            rows={data.bySeller}
            empty="Sin facturas en el periodo."
          />
        </ChartCard>
      </div>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Facturas del periodo</h3>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            dense
            columns={[
              { key: "invoiceNumber", header: "Factura" },
              { key: "invoiceDate", header: "Fecha", render: (r) => formatDayShort(r.invoiceDate) },
              { key: "clientName", header: "Cliente", render: (r) => r.clientName || "—" },
              { key: "sellerName", header: "Vendedor" },
              { key: "quoteFolios", header: "Cotización", render: (r) => r.quoteFolios || "—" },
              { key: "netAmount", header: "Monto c/IVA", align: "right", render: (r) => formatMoney(r.netAmount) },
              {
                key: "state",
                header: "Estado",
                render: (r) =>
                  r.paidAt ? (
                    <Badge tone="success">Pagada</Badge>
                  ) : r.receptionDate ? (
                    <Badge tone="brand">Recibida</Badge>
                  ) : (
                    <Badge tone="warning">Por recibir</Badge>
                  ),
              },
            ]}
            rows={data.invoices}
            empty="Sin facturas en el periodo."
          />
        </div>
      </Card>
    </div>
  );
}

export default SalesPanel;
