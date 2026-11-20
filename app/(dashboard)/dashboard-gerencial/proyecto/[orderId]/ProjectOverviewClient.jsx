"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatMoney } from "@/lib/utils/format";
import { SimpleTable, ProgressBar } from "@/components/kpis/ui";
import { TrackingBadge } from "@/components/kpis/CommitmentsPanel";
import {
  DETECTION_STAGE_SHORT,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_PRIORITY_TONES,
  INCIDENT_STATUS_TONES,
} from "@/domains/kpis/constants";
import { formatDayShort } from "@/domains/kpis/periods";

function Step({ label, value, hint, tone }) {
  return (
    <div className="min-w-[9rem] flex-1 rounded-[var(--radius-md)] border border-border bg-white p-3">
      <p className="text-xs text-content-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "danger" ? "text-danger-700" : "text-content"}`}>{value}</p>
      {hint && <p className="text-xs text-content-muted">{hint}</p>}
    </div>
  );
}

/** Cotizacion → venta → compras → tiempos → errores → facturacion → cobranza. */
export default function ProjectOverviewClient({ orderId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/api/kpis/proyecto/${orderId}`));
    } catch (err) {
      setError(err.message || "No se pudo cargar el proyecto");
    }
  }, [orderId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <Skeleton className="h-96 w-full" />;

  const { order, money, hours } = data;
  const steps = [
    { label: "Cotizado", value: formatMoney(money.quoted), hint: order.quote?.folio },
    { label: "Comprado", value: formatMoney(money.purchased), hint: `${data.purchaseOrders.length} OC · material cotizado ${formatMoney(money.quotedMaterials)}` },
    { label: "Horas reales / cotizadas", value: `${hours.real} / ${hours.quoted}`, hint: `Retrabajo ${hours.rework} h`, tone: hours.real > hours.quoted && hours.quoted > 0 ? "danger" : undefined },
    { label: "Costo de errores", value: formatMoney(money.errorsCost), hint: `${data.errors.length} error(es)`, tone: money.errorsCost > 0 ? "danger" : undefined },
    { label: "Facturado", value: formatMoney(money.billed), hint: `${data.invoices.length} factura(s)` },
    { label: "Cobrado", value: formatMoney(money.collected), hint: `Por cobrar ${formatMoney(money.pendingCollection)}` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Proyecto ${order.folio}`}
        description={`${order.client?.commercialName || ""}${order.seller ? ` · Vendedor: ${order.seller.name}` : ""}${order.quote ? ` · Cotización ${order.quote.folio}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button as={Link} href="/dashboard-gerencial" size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <Button as={Link} href={`/produccion/${order.id}`} size="sm" variant="secondary">
              Orden de producción
            </Button>
            {order.quote && (
              <Button as={Link} href={`/cotizaciones/${order.quote.id}`} size="sm" variant="secondary">
                Cotización
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-stretch gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-center gap-2">
              <Step {...s} />
              {i < steps.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-content-muted xl:block" aria-hidden />}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-content-muted">Avance de producción</span>
          <ProgressBar percent={order.progressPercentage} className="flex-1" label="Avance de producción" />
          <span className="text-sm tabular-nums">{order.progressPercentage}%</span>
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Partidas y compromisos</h3>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            rows={data.items}
            columns={[
              { key: "position", header: "Part.", align: "right" },
              { key: "description", header: "Descripción", className: "min-w-[14rem]" },
              { key: "responsible", header: "Responsable" },
              { key: "commitmentDate", header: "Compromiso", render: (r) => formatDayShort(r.commitmentDate) },
              { key: "hours", header: "Horas real / cot.", align: "right", render: (r) => `${r.realHours} / ${r.quotedHours}` },
              { key: "status", header: "Estado", render: (r) => <TrackingBadge tracking={r.tracking} /> },
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Incidencias</h3>
          </div>
          <div className="p-3 sm:p-5">
            <SimpleTable
              dense
              rows={data.incidents}
              empty="Sin incidencias."
              columns={[
                {
                  key: "title",
                  header: "Incidencia",
                  render: (r) => (
                    <Link href={`/incidencias?id=${r.id}`} className="text-brand-700 hover:underline">
                      {r.title}
                    </Link>
                  ),
                },
                { key: "priority", header: "Prioridad", render: (r) => <Badge tone={INCIDENT_PRIORITY_TONES[r.priority]}>{INCIDENT_PRIORITY_LABELS[r.priority]}</Badge> },
                { key: "status", header: "Estado", render: (r) => <Badge tone={INCIDENT_STATUS_TONES[r.status]}>{r.statusLabel}</Badge> },
                { key: "assignedTo", header: "Responsable", render: (r) => r.assignedTo?.name || "—" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Errores de calidad</h3>
          </div>
          <div className="p-3 sm:p-5">
            <SimpleTable
              dense
              rows={data.errors}
              empty="Sin errores registrados."
              columns={[
                { key: "detectedAt", header: "Fecha", render: (r) => formatDayShort(r.detectedAt) },
                { key: "stage", header: "Detección", render: (r) => DETECTION_STAGE_SHORT[r.detectionStage] },
                { key: "cause", header: "Causa", render: (r) => r.causeLabel || "Sin clasificar" },
                { key: "cost", header: "Costo", align: "right", render: (r) => formatMoney(r.cost.total) },
              ]}
            />
          </div>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Órdenes de compra</h3>
          </div>
          <div className="p-3 sm:p-5">
            <SimpleTable
              dense
              rows={data.purchaseOrders}
              empty="Sin órdenes de compra."
              columns={[
                {
                  key: "folio",
                  header: "OC",
                  render: (r) => (
                    <Link href={`/ordenes-compra/${r.id}`} className="text-brand-700 hover:underline">
                      {r.folio}
                    </Link>
                  ),
                },
                { key: "supplier", header: "Proveedor", render: (r) => r.supplier?.name || "—" },
                { key: "status", header: "Estatus" },
                { key: "total", header: "Total", align: "right", render: (r) => formatMoney(r.total) },
              ]}
            />
          </div>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Facturación y cobranza</h3>
          </div>
          <div className="p-3 sm:p-5">
            <SimpleTable
              dense
              rows={data.invoices}
              empty="Sin facturas ligadas a la cotización."
              columns={[
                { key: "invoiceNumber", header: "Factura" },
                { key: "invoiceDate", header: "Fecha", render: (r) => formatDayShort(r.invoiceDate) },
                { key: "netAmount", header: "Monto", align: "right", render: (r) => formatMoney(r.netAmount) },
                {
                  key: "state",
                  header: "Estado",
                  render: (r) =>
                    r.paidAt ? (
                      <Badge tone="success">Pagada {formatDayShort(r.paidAt)}</Badge>
                    ) : r.receptionDate ? (
                      <Badge tone="brand">Recibida</Badge>
                    ) : (
                      <Badge tone="warning">Por recibir</Badge>
                    ),
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
