"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { formatMoney } from "@/lib/utils/format";
import { formatDayShort } from "@/domains/kpis/periods";
import { ChartCard, DeltaBadge, HBarChart, SimpleTable, Stat, compactMoney, formatDays } from "./ui";
import { usePanelData } from "./usePanelData";
import { CorrectionModal } from "./CorrectionModal";

const DIST_MODES = [
  ["amount", "Monto"],
  ["count", "Nº facturas"],
  ["pct", "% del saldo"],
];

/** KPI 4 — Cobranza y facturas fuera de tiempo de credito. */
export function CollectionPanel({ params }) {
  const { has } = usePermissions();
  const canCorrect = has("kpis.correct_data");
  const { data, loading, error, reload } = usePanelData("/api/kpis/cobranza", params);
  const [mode, setMode] = useState("amount");
  const [correcting, setCorrecting] = useState(null);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (loading && !data) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  const distRows = data.distributionByClient.map((c) => ({
    key: c.key,
    label: c.label,
    value: mode === "amount" ? c.amount : mode === "count" ? c.count : c.amountPct,
    display: mode === "amount" ? compactMoney(c.amount) : mode === "count" ? c.count : `${c.amountPct}%`,
    detail: `${formatMoney(c.amount)} · ${c.count} factura(s) · ${c.amountPct}% del saldo vencido`,
    tone: "danger",
  }));

  const invoiceColumns = (extra = []) => [
    { key: "clientName", header: "Cliente", render: (r) => r.clientName || "Sin cliente" },
    { key: "invoiceNumber", header: "Factura", render: (r) => <span className="font-medium">{r.invoiceNumber}</span> },
    { key: "sellerName", header: "Vendedor" },
    { key: "netAmount", header: "Monto", align: "right", render: (r) => formatMoney(r.netAmount) },
    { key: "receptionDate", header: "Recepción", render: (r) => formatDayShort(r.receptionDate) },
    { key: "credit", header: "Crédito", align: "right", render: (r) => (r.creditDays == null ? `${data.defaultCreditDays}*` : r.creditDays) },
    { key: "dueKey", header: "Fecha límite", render: (r) => formatDayShort(r.dueKey) },
    ...extra,
    {
      key: "fix",
      header: "",
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setCorrecting(r)} aria-label="Corregir o ver historial" title="Corregir / historial">
          <PencilLine className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Saldo vencido" value={formatMoney(data.overdueAmount)} tone={data.overdueAmount ? "danger" : "default"}>
            <DeltaBadge delta={data.compare.overdueAmount} format="money" goodWhen="down" />
          </Stat>
          <Stat label="Facturas vencidas" value={data.overdueCount} hint={`${data.overdueClients} cliente(s)`} />
          <Stat
            label="Por vencer"
            value={formatMoney(data.dueSoonAmount)}
            hint={`${data.dueSoonCount} factura(s) en ${data.dueSoonDays} días`}
          />
          <Stat label="Tiempo medio de cobro · desde recepción" value={formatDays(data.avgReceptionToPayment)}>
            <DeltaBadge delta={data.compare.avgReceptionToPayment} goodWhen="down" suffix=" d" />
          </Stat>
          <Stat label="Tiempo medio de cobro · desde factura" value={formatDays(data.avgInvoiceToPayment)}>
            <DeltaBadge delta={data.compare.avgInvoiceToPayment} goodWhen="down" suffix=" d" />
          </Stat>
        </div>
        <p className="mt-3 text-xs text-content-muted">
          Fecha límite = recepción + días de crédito del cliente. Cobradas en el periodo: {data.paidCount} ({formatMoney(data.paidAmount)}).
          Saldo abierto total al {formatDayShort(data.asOf)}: {formatMoney(data.outstandingAmount)}. *Crédito por defecto.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-2"
          title="¿Dónde está concentrado el dinero vencido?"
          description="Distribución del saldo vencido por cliente"
          actions={
            <div className="inline-flex rounded-[var(--radius-sm)] border border-border p-0.5" role="group" aria-label="Medida">
              {DIST_MODES.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mode === k}
                  onClick={() => setMode(k)}
                  className={`rounded-[6px] px-2 py-1 text-xs font-medium ${mode === k ? "bg-brand-600 text-white" : "text-content-muted hover:bg-surface-muted"}`}
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
                { key: "label", header: "Cliente" },
                { key: "amount", header: "Monto", align: "right", render: (r) => formatMoney(r.amount) },
                { key: "count", header: "Facturas", align: "right" },
                { key: "amountPct", header: "%", align: "right", render: (r) => `${r.amountPct}%` },
              ]}
              rows={data.distributionByClient}
            />
          }
        >
          <HBarChart rows={distRows.slice(0, 12)} empty="Sin saldo vencido. 🎉" />
        </ChartCard>

        <Card className="lg:col-span-3">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-content">Próximas a vencer</h3>
          </div>
          <div className="p-3 sm:p-5">
            <SimpleTable
              dense
              columns={invoiceColumns([
                { key: "daysToDue", header: "Vence en", align: "right", render: (r) => `${r.daysToDue} d` },
              ])}
              rows={data.dueSoon}
              empty="Ninguna factura vence en los próximos días."
            />
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Facturas fuera de crédito</h3>
          <p className="text-xs text-content-muted">Vencidas sin pago al corte y pagadas con atraso en el periodo</p>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            columns={invoiceColumns([
              {
                key: "paid",
                header: "Fecha pago",
                render: (r) => (r.paidLate ? <Badge tone="warning">{formatDayShort(r.paidKey)}</Badge> : "—"),
              },
              {
                key: "daysOverdue",
                header: "Días vencidos",
                align: "right",
                render: (r) => <span className="font-semibold text-danger-700">{r.daysOverdue}</span>,
              },
            ])}
            rows={[...data.overdue, ...data.paidLate]}
            empty="No hay facturas fuera de crédito."
          />
        </div>
      </Card>

      <CorrectionModal
        open={Boolean(correcting)}
        invoice={correcting}
        canCorrect={canCorrect}
        defaultField="paidAt"
        onClose={() => setCorrecting(null)}
        onSaved={() => {
          setCorrecting(null);
          reload();
        }}
      />
    </div>
  );
}

export default CollectionPanel;
