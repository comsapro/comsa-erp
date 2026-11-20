"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { formatMoney } from "@/lib/utils/format";
import { formatDayShort } from "@/domains/kpis/periods";
import { ChartCard, ColumnChart, DeltaBadge, HBarChart, SimpleTable, Stat, compactMoney, formatDays } from "./ui";
import { usePanelData } from "./usePanelData";
import { CorrectionModal } from "./CorrectionModal";

/** KPI 3 — Facturas pendientes de recepcion por cliente. */
export function ReceptionPanel({ params }) {
  const { has } = usePermissions();
  const canCorrect = has("kpis.correct_data");
  const [groupBy, setGroupBy] = useState("month");
  const { data, loading, error, reload } = usePanelData("/api/kpis/recepcion", { ...params, groupBy });
  const [correcting, setCorrecting] = useState(null);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (loading && !data) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  const correctionColumn = {
    key: "fix",
    header: "",
    render: (r) => (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setCorrecting(r)}
        aria-label={canCorrect ? "Corregir datos" : "Historial de correcciones"}
        title={canCorrect ? "Corregir datos" : "Historial de correcciones"}
      >
        <PencilLine className="h-3.5 w-3.5" />
      </Button>
    ),
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Monto pendiente de recepción" value={formatMoney(data.pendingAmount)} tone={data.pendingCount ? "danger" : "default"}>
            <DeltaBadge delta={data.compare.pendingAmount} format="money" goodWhen="down" />
          </Stat>
          <Stat label="Facturas pendientes" value={data.pendingCount} />
          <Stat label="Tiempo medio de recepción" value={formatDays(data.avgReceptionDays)} hint="Envío (o factura) → recepción">
            <DeltaBadge delta={data.compare.avgDays} goodWhen="down" suffix=" d" />
          </Stat>
          <Stat label="Recibidas en el periodo" value={data.receivedCount} hint={`Corte al ${formatDayShort(data.asOf)}`} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Evolución del monto pendiente de recepción"
          description="Monto sin recepcionar al cierre de cada periodo"
          actions={
            <div className="inline-flex rounded-[var(--radius-sm)] border border-border p-0.5" role="group" aria-label="Agrupar por">
              {[
                ["week", "Semana"],
                ["month", "Mes"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={groupBy === k}
                  onClick={() => setGroupBy(k)}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${groupBy === k ? "bg-brand-600 text-white" : "text-content-muted hover:bg-surface-muted"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          }
          table={
            <SimpleTable
              dense
              rowKey={(r) => r.key}
              columns={[
                { key: "label", header: "Periodo" },
                { key: "count", header: "Facturas", align: "right" },
                { key: "amount", header: "Monto", align: "right", render: (r) => formatMoney(r.amount) },
              ]}
              rows={data.history}
            />
          }
        >
          <ColumnChart
            bars={data.history.map((h) => ({
              key: h.key,
              label: h.label,
              value: h.amount,
              display: formatMoney(h.amount),
              detail: `${h.count} factura(s)`,
            }))}
            formatValue={compactMoney}
          />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Pendiente por cliente"
          table={
            <SimpleTable
              dense
              rowKey={(r) => r.key}
              columns={[
                { key: "label", header: "Cliente" },
                { key: "count", header: "Facturas", align: "right" },
                { key: "amount", header: "Monto", align: "right", render: (r) => formatMoney(r.amount) },
              ]}
              rows={data.byClient}
            />
          }
        >
          <HBarChart
            rows={data.byClient.slice(0, 10).map((c) => ({
              key: c.key,
              label: c.label,
              value: c.amount,
              display: compactMoney(c.amount),
              detail: `${formatMoney(c.amount)} · ${c.count} factura(s)`,
            }))}
            empty="Todas las facturas fueron recepcionadas."
          />
        </ChartCard>
      </div>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Facturas todavía no recibidas</h3>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            columns={[
              { key: "invoiceNumber", header: "Factura", render: (r) => <span className="font-medium">{r.invoiceNumber}</span> },
              { key: "clientName", header: "Cliente", render: (r) => r.clientName || "Sin cliente" },
              { key: "sellerName", header: "Vendedor" },
              { key: "quoteFolios", header: "Cotización · partidas", render: (r) => (r.quoteFolios ? `${r.quoteFolios}${r.partidas ? ` · ${r.partidas}` : ""}` : "—") },
              { key: "clientPoNumber", header: "PO" },
              { key: "invoiceDate", header: "Fecha factura", render: (r) => formatDayShort(r.invoiceDate) },
              { key: "sentAt", header: "Envío", render: (r) => (r.sentAt ? formatDayShort(r.sentAt) : "—") },
              {
                key: "daysPending",
                header: "Días pendientes",
                align: "right",
                render: (r) => <span className={r.daysPending > 7 ? "font-semibold text-danger-700" : undefined}>{r.daysPending}</span>,
              },
              { key: "netAmount", header: "Monto", align: "right", render: (r) => formatMoney(r.netAmount) },
              correctionColumn,
            ]}
            rows={data.pending}
            empty="No hay facturas pendientes de recepción."
          />
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Facturas recibidas en el periodo</h3>
          <p className="text-xs text-content-muted">Base del tiempo medio de recepción</p>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            dense
            columns={[
              { key: "invoiceNumber", header: "Factura" },
              { key: "clientName", header: "Cliente", render: (r) => r.clientName || "Sin cliente" },
              { key: "invoiceDate", header: "Fecha factura", render: (r) => formatDayShort(r.invoiceDate) },
              { key: "receptionDate", header: "Fecha recepción", render: (r) => formatDayShort(r.receptionDate) },
              { key: "receptionDays", header: "Días", align: "right" },
              { key: "netAmount", header: "Monto", align: "right", render: (r) => formatMoney(r.netAmount) },
              correctionColumn,
            ]}
            rows={data.received}
            empty="Sin recepciones registradas en el periodo."
          />
        </div>
      </Card>

      <CorrectionModal
        open={Boolean(correcting)}
        invoice={correcting}
        canCorrect={canCorrect}
        onClose={() => setCorrecting(null)}
        onSaved={() => {
          setCorrecting(null);
          reload();
        }}
      />
    </div>
  );
}

export default ReceptionPanel;
