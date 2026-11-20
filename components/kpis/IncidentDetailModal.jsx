"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Hand, Lock, MessageSquare, RotateCcw, UserRoundCog, Flag } from "lucide-react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatDateTime } from "@/lib/utils/format";
import {
  INCIDENT_PRIORITIES,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_PRIORITY_TONES,
  INCIDENT_STATUS_TONES,
} from "@/domains/kpis/constants";
import { useAssignableUsers } from "./IncidentFormModal";

const KIND_LABELS = {
  CREATED: "Registro",
  ATTENDED: "En atención",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada",
  REOPENED: "Reabierta",
  REASSIGNED: "Reasignación",
  PRIORITY: "Prioridad",
  COMMENT: "Comentario",
};

/** Detalle y seguimiento de una incidencia hasta su resolucion. */
export function IncidentDetailModal({ incidentId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(null);
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const users = useAssignableUsers(Boolean(data?.permissions?.reassign));

  const load = useCallback(async () => {
    if (!incidentId) return;
    setError("");
    try {
      const res = await api.get(`/api/incidencias/${incidentId}`);
      setData(res);
      setAssignee(res.assignedTo?.id || "");
      setPriority(res.priority);
    } catch (err) {
      setError(err.message || "No se pudo cargar la incidencia");
    }
  }, [incidentId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(null);
    setComment("");
    load();
  }, [load]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    try {
      const res = await api.post(`/api/incidencias/${incidentId}/acciones`, {
        action,
        comment: comment.trim() || null,
        ...extra,
      });
      setData(res);
      setComment("");
      onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo completar la accion");
    } finally {
      setBusy(null);
    }
  }

  const p = data?.permissions || {};

  return (
    <Modal open={Boolean(incidentId)} onClose={busy ? undefined : onClose} title="Seguimiento de incidencia" size="xl">
      {!data && !error && <Skeleton className="h-64 w-full" />}
      {error && <Alert variant="danger">{error}</Alert>}
      {data && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={INCIDENT_STATUS_TONES[data.status]}>{data.statusLabel}</Badge>
              <Badge tone={INCIDENT_PRIORITY_TONES[data.priority]}>
                <Flag className="h-3 w-3" aria-hidden />
                {INCIDENT_PRIORITY_LABELS[data.priority]}
              </Badge>
              {data.blocking && <Badge tone="danger">Trabajo detenido</Badge>}
            </div>
            <h3 className="text-base font-semibold text-content">{data.title}</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-content-muted">Proyecto</dt>
                <dd>
                  <Link href={`/produccion/${data.productionOrderId}`} className="text-brand-700 hover:underline">
                    {data.project}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Cotización</dt>
                <dd>{data.quoteFolio || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Cliente</dt>
                <dd>{data.client || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Partida</dt>
                <dd>{data.position ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Razón</dt>
                <dd>{data.reasonLabel || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Responsable</dt>
                <dd className="font-medium">{data.assignedTo?.name || "Sin asignar"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Generada por</dt>
                <dd>{data.reportedBy?.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Creada</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Atención</dt>
                <dd>{formatDateTime(data.attendedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Resolución</dt>
                <dd>{formatDateTime(data.resolvedAt)}</dd>
              </div>
              {data.relatedModuleLabels?.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs text-content-muted">Ruta</dt>
                  <dd>{data.relatedModuleLabels.join(" → ")}</dd>
                </div>
              )}
              {data.itemDescription && (
                <div className="col-span-2">
                  <dt className="text-xs text-content-muted">Trabajo</dt>
                  <dd>{data.itemDescription}</dd>
                </div>
              )}
            </dl>
            {data.requiredAction && (
              <Alert variant="warning" title="Acción requerida">
                {data.requiredAction}
              </Alert>
            )}
            {data.actionTaken && (
              <Alert variant="success" title="Cómo se resolvió">
                {data.actionTaken}
              </Alert>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:col-span-3">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-content">Historial</h4>
              <ol className="max-h-72 space-y-3 overflow-y-auto border-l-2 border-border pl-4">
                {data.comments.map((c) => (
                  <li key={c.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600" aria-hidden />
                    <p className="text-xs text-content-muted">
                      <span className="font-medium text-content">{KIND_LABELS[c.kind] || c.kind}</span> ·{" "}
                      {c.createdBy?.name || "Sistema"} · {formatDateTime(c.createdAt)}
                    </p>
                    <p className="whitespace-pre-line text-sm text-content">{c.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            {(p.comment || p.resolve || p.attend) && (
              <div className="space-y-2 rounded-[var(--radius-md)] border border-border p-3">
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={p.resolve ? "Comentario o cómo se resolvió (ej. Material comprado y recibido)…" : "Comentario…"}
                  aria-label="Comentario"
                />
                <div className="flex flex-wrap gap-2">
                  {p.attend && (
                    <Button size="sm" variant="secondary" loading={busy === "attend"} onClick={() => act("attend")}>
                      <Hand className="h-4 w-4" />
                      Atender
                    </Button>
                  )}
                  {p.comment && (
                    <Button size="sm" variant="secondary" loading={busy === "comment"} disabled={!comment.trim()} onClick={() => act("comment")}>
                      <MessageSquare className="h-4 w-4" />
                      Comentar
                    </Button>
                  )}
                  {p.resolve && (
                    <Button size="sm" loading={busy === "resolve"} disabled={!comment.trim()} onClick={() => act("resolve")}>
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar resuelta
                    </Button>
                  )}
                  {p.close && (
                    <Button size="sm" variant="ghost" loading={busy === "close"} onClick={() => act("close")}>
                      <Lock className="h-4 w-4" />
                      Cerrar
                    </Button>
                  )}
                  {p.reopen && (
                    <Button size="sm" variant="ghost" loading={busy === "reopen"} disabled={!comment.trim()} onClick={() => act("reopen")}>
                      <RotateCcw className="h-4 w-4" />
                      Reabrir
                    </Button>
                  )}
                </div>
                {p.resolve && !comment.trim() && (
                  <p className="text-xs text-content-muted">Para marcarla resuelta describe cómo se resolvió.</p>
                )}
              </div>
            )}
            {!p.comment && p.reopen && (
              <div className="space-y-2">
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Motivo para reabrir…" />
                <Button size="sm" variant="secondary" disabled={!comment.trim()} loading={busy === "reopen"} onClick={() => act("reopen")}>
                  <RotateCcw className="h-4 w-4" />
                  Reabrir
                </Button>
              </div>
            )}

            {(p.reassign || p.priority) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {p.reassign && (
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-xs text-content-muted">
                      Reasignar a
                      <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9">
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!assignee || assignee === data.assignedTo?.id}
                      loading={busy === "reassign"}
                      onClick={() => act("reassign", { assignedToUserId: assignee })}
                      aria-label="Reasignar"
                    >
                      <UserRoundCog className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {p.priority && (
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-xs text-content-muted">
                      Prioridad
                      <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9">
                        {INCIDENT_PRIORITIES.map((pr) => (
                          <option key={pr} value={pr}>
                            {INCIDENT_PRIORITY_LABELS[pr]}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={priority === data.priority}
                      loading={busy === "priority"}
                      onClick={() => act("priority", { priority })}
                      aria-label="Cambiar prioridad"
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default IncidentDetailModal;
