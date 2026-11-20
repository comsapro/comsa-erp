"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { Badge } from "@/components/ui/Badge";
import {
  INCIDENT_PRIORITIES,
  INCIDENT_PRIORITY_LABELS,
  KPI_MODULES,
} from "@/domains/kpis/constants";
import { suggestResponsible } from "@/domains/kpis/calculations";
import { formatDayShort } from "@/domains/kpis/periods";

let usersCache = null;

export function useAssignableUsers(enabled = true) {
  const [users, setUsers] = useState(usersCache || []);
  useEffect(() => {
    if (!enabled || usersCache) return;
    api
      .get("/api/kpis/usuarios")
      .then((res) => {
        usersCache = res?.data || [];
        setUsers(usersCache);
      })
      .catch(() => setUsers([]));
  }, [enabled]);
  return users;
}

/**
 * Registrar incidencia detectada en la junta: actualiza el estado del trabajo
 * (Detenido), notifica al responsable y deja historial.
 */
export function IncidentFormModal({ open, row, stopReasons = [], onClose, onSaved }) {
  const users = useAssignableUsers(open);
  const [reasonCode, setReasonCode] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [priority, setPriority] = useState("HIGH");
  const [stopsWork, setStopsWork] = useState(true);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setReasonCode("");
    setAssignedToUserId("");
    setPriority("HIGH");
    setStopsWork(true);
    setTitle("");
    setComment("");
    setError("");
    setFieldErrors({});
  }, [open, row?.id]);

  const reason = useMemo(() => stopReasons.find((r) => r.code === reasonCode) || null, [stopReasons, reasonCode]);

  function chooseReason(code) {
    setReasonCode(code);
    const entry = stopReasons.find((r) => r.code === code);
    const suggested = suggestResponsible(entry?.suggestedResponsible, {
      sellerId: row?.sellerId,
      assigneeId: row?.assignedToUserId,
    });
    if (suggested) setAssignedToUserId(suggested);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const saved = await api.post("/api/kpis/incidencias", {
        productionItemId: row.id,
        reasonCode,
        assignedToUserId,
        priority,
        stopsWork,
        title: title || null,
        comment: comment || null,
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || "No se pudo registrar la incidencia");
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  }

  const suggestedId = suggestResponsible(reason?.suggestedResponsible, {
    sellerId: row?.sellerId,
    assigneeId: row?.assignedToUserId,
  });

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Registrar incidencia"
      description="Se actualiza el estado del trabajo, se notifica al responsable y queda en el historial."
      size="lg"
    >
      {row && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <dl className="grid gap-2 rounded-[var(--radius-sm)] bg-surface-muted px-3 py-2.5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-content-muted">Proyecto</dt>
              <dd className="font-medium">{row.project}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-muted">Cotización</dt>
              <dd>{row.quoteFolio || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-muted">Cliente</dt>
              <dd className="truncate">{row.client}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-muted">Partida · compromiso</dt>
              <dd>
                {row.position} · {formatDayShort(row.commitmentDate)}
              </dd>
            </div>
            <div className="sm:col-span-4">
              <dt className="text-xs text-content-muted">Descripción</dt>
              <dd>{row.description}</dd>
            </div>
          </dl>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estatus" htmlFor="inc-stops">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  id="inc-stops"
                  type="checkbox"
                  checked={stopsWork}
                  onChange={(e) => setStopsWork(e.target.checked)}
                />
                <span>
                  <strong>Detenido</strong> — el trabajo no puede continuar
                </span>
              </label>
            </Field>
            <Field label="Prioridad" htmlFor="inc-priority" required>
              <Select id="inc-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {INCIDENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {INCIDENT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Razón" htmlFor="inc-reason" required error={fieldErrors.reasonCode?.[0]}>
              <Select
                id="inc-reason"
                value={reasonCode}
                onChange={(e) => chooseReason(e.target.value)}
                invalid={Boolean(fieldErrors.reasonCode)}
                required
              >
                <option value="">Selecciona…</option>
                {stopReasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Responsable de dar seguimiento"
              htmlFor="inc-assignee"
              required
              hint={
                suggestedId && suggestedId === assignedToUserId
                  ? "Sugerido automáticamente según el proyecto."
                  : undefined
              }
              error={fieldErrors.assignedToUserId?.[0]}
            >
              <Select
                id="inc-assignee"
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.id === row.sellerId ? " (vendedor)" : ""}
                    {u.id === row.assignedToUserId ? " (responsable partida)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {reason && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
              <span>Ruta:</span>
              {(reason.relatedModules || []).length ? (
                reason.relatedModules.map((m, i) => (
                  <span key={m} className="flex items-center gap-1">
                    {i > 0 && <span aria-hidden>→</span>}
                    <Badge tone="brand">{KPI_MODULES[m] || m}</Badge>
                  </span>
                ))
              ) : (
                <span>—</span>
              )}
              {reason.requiredAction && <span className="w-full">Acción requerida: {reason.requiredAction}</span>}
            </div>
          )}

          <Field label="Detalle corto (opcional)" htmlFor="inc-title" hint="Ej. Comprar redondo 1045">
            <Input id="inc-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Comentario" htmlFor="inc-comment">
            <Textarea id="inc-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={!reasonCode || !assignedToUserId}>
              Guardar y notificar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default IncidentFormModal;
