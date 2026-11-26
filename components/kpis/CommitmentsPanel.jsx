"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ExternalLink, FolderKanban, RefreshCw, Siren } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import {
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_PRIORITY_TONES,
  MANUAL_TRACKING_STATUSES,
  TRACKING_STATUS_LABELS,
  TRACKING_STATUS_TONES,
} from "@/domains/kpis/constants";
import { formatDayMonth, formatDayShort, todayKey } from "@/domains/kpis/periods";
import { SimpleTable, Tabs } from "./ui";
import { IncidentFormModal } from "./IncidentFormModal";

const VIEWS = [
  { key: "overdue", label: "Vencidos", alert: true },
  { key: "thisWeek", label: "Esta semana" },
  { key: "lastWeek", label: "Semana anterior" },
  { key: "nextWeek", label: "Próxima semana" },
  { key: "upcoming", label: "Próximos a vencer" },
  { key: "stopped", label: "Detenidos", alert: true },
  { key: "inProgress", label: "En proceso" },
  { key: "pending", label: "Pendientes" },
];

function StatusModal({ open, row, onClose, onSaved }) {
  const [status, setStatus] = useState("AUTO");
  const [deliveredAt, setDeliveredAt] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStatus(row.trackingStatus || "AUTO");
    setDeliveredAt(row.deliveredAt || todayKey());
    setReason("");
    setError("");
  }, [open, row]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch(`/api/kpis/trabajos/${row.id}/estatus`, {
        status,
        deliveredAt: status === "DELIVERED" ? deliveredAt : null,
        reason: reason || null,
      });
      onSaved?.(updated);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estatus");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Cambiar estatus del trabajo" size="md">
      {row && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-content-muted">
            {row.project} · Partida {row.position} — {row.description}
          </p>
          {error && <Alert variant="danger">{error}</Alert>}
          <Field
            label="Estatus"
            htmlFor="st-status"
            hint="“Automático” lo calcula con el avance de Producción y Calidad. “Detenido” se registra con una incidencia; “Retrasado” se calcula por la fecha compromiso."
          >
            <Select id="st-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="AUTO">Automático (según Producción y Calidad)</option>
              {MANUAL_TRACKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TRACKING_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          {status === "DELIVERED" && (
            <Field label="Fecha de entrega" htmlFor="st-delivered" required>
              <Input id="st-delivered" type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
            </Field>
          )}
          <Field label="Comentario (opcional)" htmlFor="st-reason">
            <Textarea id="st-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TrackingBadge({ tracking }) {
  if (!tracking) return null;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={TRACKING_STATUS_TONES[tracking.status] || "neutral"}>
        {tracking.status === "STOPPED" && <AlertOctagon className="h-3 w-3" aria-hidden />}
        {TRACKING_STATUS_LABELS[tracking.status] || tracking.status}
      </Badge>
      {tracking.overdue && (
        <span className="text-[11px] text-danger-700">
          +{tracking.daysLate} día{tracking.daysLate === 1 ? "" : "s"}
          {tracking.status !== "DELAYED" ? " de retraso" : ""}
          {tracking.status === "DELAYED" ? ` · ${TRACKING_STATUS_LABELS[tracking.baseStatus]}` : ""}
        </span>
      )}
    </span>
  );
}

/**
 * KPI 1 — Seguimiento de trabajos y compromisos. La informacion viene del
 * calendario de Produccion (fechas compromiso); no se captura de nuevo.
 */
export function CommitmentsPanel({ initialView = "overdue", onChanged, meeting = false, date: controlledDate }) {
  const { has, hasAny } = usePermissions();
  const { toast } = useToast();
  const canIncident = hasAny(["kpis.manage_incidents", "production.manage_incidents"]);
  const canStatus = has("kpis.update_status");
  const [date, setDate] = useState(controlledDate || todayKey());
  const [view, setView] = useState(initialView);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [incidentRow, setIncidentRow] = useState(null);
  const [statusRow, setStatusRow] = useState(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (controlledDate) setDate(controlledDate);
  }, [controlledDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get(`/api/kpis/compromisos${toQuery({ date })}`));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los compromisos");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const tabs = VIEWS.map((v) => ({ ...v, count: data?.counts?.[v.key] }));
  const rows = data?.groups?.[view] || [];

  const columns = useMemo(
    () => [
      {
        key: "project",
        header: "Proyecto",
        render: (r) => (
          <Link href={`/produccion/${r.productionOrderId}`} className="font-medium text-brand-700 hover:underline">
            {r.project}
          </Link>
        ),
      },
      {
        key: "quote",
        header: "Cotización",
        render: (r) =>
          r.quoteId ? (
            <Link href={`/cotizaciones/${r.quoteId}`} className="text-brand-700 hover:underline">
              {r.quoteFolio}
            </Link>
          ) : (
            r.quoteFolio || "—"
          ),
      },
      { key: "client", header: "Cliente", className: "max-w-[12rem] truncate", render: (r) => <span title={r.client}>{r.client}</span> },
      { key: "position", header: "Part.", align: "right", render: (r) => r.position },
      {
        key: "description",
        header: "Descripción",
        className: "min-w-[14rem]",
        render: (r) => (
          <div>
            <p className="line-clamp-2">{r.description}</p>
            {r.openIncidents.map((i) => (
              <Link
                key={i.id}
                href={`/incidencias?id=${i.id}`}
                className="mt-1 flex items-center gap-1 text-xs text-danger-700 hover:underline"
              >
                <Siren className="h-3 w-3 shrink-0" aria-hidden />
                <Badge tone={INCIDENT_PRIORITY_TONES[i.priority]}>{INCIDENT_PRIORITY_LABELS[i.priority]}</Badge>
                <span className="truncate">
                  {i.title} → {i.assignedTo?.name || "sin responsable"}
                </span>
              </Link>
            ))}
          </div>
        ),
      },
      {
        key: "responsible",
        header: "Responsable",
        render: (r) => (
          <div className="text-sm">
            <p>{r.responsible}</p>
            {r.sellerName && <p className="text-xs text-content-muted">Vend.: {r.sellerName}</p>}
          </div>
        ),
      },
      {
        key: "commitment",
        header: "Compromiso",
        render: (r) => (
          <span className={r.tracking.overdue ? "font-medium text-danger-700" : undefined} title={formatDayShort(r.commitmentDate)}>
            {r.commitmentDate ? formatDayMonth(r.commitmentDate) : "Sin fecha"}
          </span>
        ),
      },
      { key: "status", header: "Estado", render: (r) => <TrackingBadge tracking={r.tracking} /> },
      {
        key: "actions",
        header: "",
        render: (r) => (
          <div className="flex flex-wrap justify-end gap-1">
            {canIncident && (
              <Button size="sm" variant="subtle" onClick={() => setIncidentRow(r)}>
                <Siren className="h-3.5 w-3.5" />
                Incidencia
              </Button>
            )}
            {canStatus && (
              <Button size="sm" variant="secondary" onClick={() => setStatusRow(r)}>
                Estatus
              </Button>
            )}
            <Button
              as={Link}
              size="sm"
              variant="ghost"
              href={`/dashboard-gerencial/proyecto/${r.productionOrderId}`}
              title="Vista del proyecto"
              aria-label="Vista del proyecto"
            >
              <FolderKanban className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [canIncident, canStatus]
  );

  function afterChange(message) {
    toast({ variant: "success", title: message });
    setIncidentRow(null);
    setStatusRow(null);
    load();
    onChanged?.();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-content">Seguimiento de trabajos y compromisos</h2>
          <p className="text-xs text-content-muted">
            {data
              ? `Semana ${data.weekNumber} · ${formatDayShort(data.week.from)} – ${formatDayShort(data.week.to)} · Fuente: calendario de Producción`
              : "Fuente: calendario de Producción"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!controlledDate && (
            <Input
              type="date"
              className="h-9 w-40!"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Semana de referencia"
            />
          )}
          <Button size="sm" variant="ghost" onClick={load} aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {!meeting && (
            <Button as={Link} size="sm" variant="ghost" href="/produccion/calendario">
              <ExternalLink className="h-4 w-4" />
              Calendario
            </Button>
          )}
          {!meeting && (
            <Button as={Link} size="sm" variant="subtle" href="/compromisos">
              Compromisos manuales
            </Button>
          )}
        </div>
      </div>
      <div className="px-5 pt-2">
        <Tabs tabs={tabs} value={view} onChange={setView} />
      </div>
      <div className="p-3 sm:p-5">
        {error && <Alert variant="danger">{error}</Alert>}
        {loading && !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <SimpleTable
            columns={columns}
            rows={rows}
            empty={
              view === "overdue"
                ? "Sin compromisos vencidos. 👍"
                : view === "stopped"
                  ? "Ningún trabajo detenido."
                  : "Sin trabajos en esta vista."
            }
          />
        )}
      </div>

      <IncidentFormModal
        open={Boolean(incidentRow)}
        row={incidentRow}
        stopReasons={data?.stopReasons || []}
        onClose={() => setIncidentRow(null)}
        onSaved={() => afterChange("Incidencia registrada y responsable notificado")}
      />
      <StatusModal
        open={Boolean(statusRow)}
        row={statusRow}
        onClose={() => setStatusRow(null)}
        onSaved={() => afterChange("Estatus actualizado")}
      />
    </Card>
  );
}

export default CommitmentsPanel;
