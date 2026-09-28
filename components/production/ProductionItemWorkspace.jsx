"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { ProductionProcessesPanel } from "@/components/production/ProductionProcessesPanel";
import { ProductionItemQr } from "@/components/production/ProductionItemQr";
import { ProductionActivityFeed } from "@/components/production/ProductionActivityFeed";
import { ProductionDocuments } from "@/components/production/ProductionDocuments";
import { ProductionQualityTab } from "@/components/quality/ProductionQualityTab";
import {
  PRODUCTION_INCIDENT_STATUS_LABELS,
  PRODUCTION_INCIDENT_TYPE_LABELS,
  PRODUCTION_INCIDENT_TYPES,
  PRODUCTION_INCIDENT_STATUSES,
  PRODUCTION_ITEM_PRIORITIES,
  PRODUCTION_PRIORITY_LABELS,
} from "@/domains/production/constants";
import { formatDate } from "@/lib/utils/format";
import { toDateInputValue } from "@/lib/utils/format";

const TABS = [
  { id: "ejecucion", label: "Ejecucion" },
  { id: "actividad", label: "Actividad" },
  { id: "incidencias", label: "Incidencias" },
  { id: "evidencias", label: "Evidencias" },
  { id: "materiales", label: "Materiales" },
  { id: "documentos", label: "Documentos" },
  { id: "calidad", label: "Calidad" },
  { id: "planeacion", label: "Planeacion" },
];

export function ProductionItemWorkspace({
  productionId,
  record,
  item,
  assignables,
  quoteDocs = [],
  acting,
  canProgress,
  canManageProcesses,
  progressDraft,
  setProgressDraft,
  runItemAction,
  runProcessChange,
  onReopenRequest,
  onRecordChange,
  incidentDraft,
  setIncidentDraft,
  createIncident,
  updateIncidentStatus,
  extraDraft,
  setExtraDraft,
  saveExtraMaterial,
  savePlanning,
}) {
  const [tab, setTab] = useState("ejecucion");
  const itemIncidents = item.incidents || [];
  const openCount = itemIncidents.filter((i) =>
    ["OPEN", "IN_REVIEW"].includes(i.status)
  ).length;

  return (
    <div className="flex min-h-[520px] flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-content-muted hover:text-content"
            }`}
          >
            {t.label}
            {t.id === "incidencias" && openCount > 0 ? ` (${openCount})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4">
        {tab === "ejecucion" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Codigo QR de la partida</p>
                <p className="text-xs text-content-muted">
                  Escanear para iniciar o terminar tiempos en la etapa pendiente.
                </p>
              </div>
              <ProductionItemQr
                orderId={productionId}
                item={item}
                size="lg"
                showLabel={false}
              />
            </div>
            {canProgress && (
              <div className="grid gap-3 rounded-md bg-surface-muted p-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-content-muted">
                    Cant. completada
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={Number(item.quantity)}
                    value={progressDraft.completedQuantity}
                    onChange={(e) =>
                      setProgressDraft((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          completedQuantity: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
                  {item.status === "PENDING" && (
                    <Can permission="production.update_progress">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={acting}
                        onClick={() => runItemAction(item.id, "start")}
                      >
                        Iniciar partida
                      </Button>
                    </Can>
                  )}
                  <Can permission="production.update_progress">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={acting}
                      onClick={() =>
                        runItemAction(item.id, "update-progress", {
                          completedQuantity: Number(progressDraft.completedQuantity),
                        })
                      }
                    >
                      Guardar avance
                    </Button>
                  </Can>
                  <Can permission="production.complete_item">
                    <Button
                      size="sm"
                      loading={acting}
                      onClick={() => runItemAction(item.id, "complete")}
                    >
                      Completar partida
                    </Button>
                  </Can>
                </div>
              </div>
            )}
            {item.status === "COMPLETED" && onReopenRequest && (
              <Can permission="production.reopen_item">
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-muted p-3">
                  <p className="mr-auto text-xs text-content-muted">
                    Partida terminada. Si el cierre fue un error o la pieza regresa de calidad,
                    registra el motivo.
                  </p>
                  <Button
                    size="sm"
                    variant="subtle"
                    loading={acting}
                    onClick={() => onReopenRequest(item, "uncomplete")}
                  >
                    Deshacer terminado
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={acting}
                    onClick={() => onReopenRequest(item, "rework")}
                  >
                    Regresar a fabricacion
                  </Button>
                </div>
              </Can>
            )}
            <ProductionProcessesPanel
              productionId={productionId}
              item={item}
              assignables={assignables}
              canManage={canManageProcesses}
              acting={acting}
              onChanged={(type, processId, payload) =>
                runProcessChange(item.id, type, processId, payload)
              }
            />
          </div>
        )}

        {tab === "actividad" && (
          <ProductionActivityFeed
            productionId={productionId}
            itemId={item.id}
            onSubmitted={onRecordChange}
          />
        )}

        {tab === "incidencias" && (
          <div className="space-y-4">
            <Can permission="production.manage_incidents">
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <Input
                  placeholder="Titulo"
                  value={incidentDraft.title}
                  onChange={(e) =>
                    setIncidentDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
                <Select
                  value={incidentDraft.type}
                  onChange={(e) =>
                    setIncidentDraft((d) => ({ ...d, type: e.target.value }))
                  }
                >
                  {PRODUCTION_INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PRODUCTION_INCIDENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <Textarea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Descripcion"
                  value={incidentDraft.description}
                  onChange={(e) =>
                    setIncidentDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={incidentDraft.blocking}
                    onChange={(e) =>
                      setIncidentDraft((d) => ({ ...d, blocking: e.target.checked }))
                    }
                  />
                  Bloqueante (impide cierre)
                </label>
                <Button size="sm" loading={acting} onClick={() => createIncident(item.id)}>
                  Registrar incidencia
                </Button>
              </div>
            </Can>
            {!itemIncidents.length ? (
              <p className="text-sm text-content-muted">Sin incidencias.</p>
            ) : (
              <ul className="space-y-2">
                {itemIncidents.map((inc) => (
                  <li key={inc.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {inc.title}{" "}
                          {inc.blocking ? (
                            <span className="text-danger-700">(bloqueante)</span>
                          ) : null}
                        </p>
                        <p className="text-content-muted">{inc.description}</p>
                      </div>
                      <Badge>{PRODUCTION_INCIDENT_STATUS_LABELS[inc.status]}</Badge>
                    </div>
                    <Can permission="production.manage_incidents">
                      <Select
                        className="mt-2 max-w-xs"
                        value={inc.status}
                        onChange={(e) => updateIncidentStatus(inc.id, e.target.value)}
                      >
                        {PRODUCTION_INCIDENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PRODUCTION_INCIDENT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </Can>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "evidencias" && (
          <ProductionDocuments
            productionId={productionId}
            itemId={item.id}
            initialAttachments={(record.attachments || []).filter(
              (a) => a.productionItemId === item.id
            )}
            canUpload={record.status !== "CANCELLED"}
          />
        )}

        {tab === "materiales" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Materiales de origen</p>
              {!(item.sourceMaterials || []).length ? (
                <p className="text-sm text-content-muted">Sin materiales de cotizacion.</p>
              ) : (
                <ul className="space-y-1 text-sm text-content-muted">
                  {item.sourceMaterials.map((mat) => (
                    <li key={mat.id}>
                      {mat.descriptionSnapshot} · {Number(mat.quantity)} {mat.unit || ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Adicionales de piso</p>
              {(item.extraMaterials || []).length === 0 && (
                <p className="mb-2 text-sm text-content-muted">Sin materiales extra.</p>
              )}
              <ul className="mb-3 space-y-1 text-sm">
                {(item.extraMaterials || []).map((m) => (
                  <li key={m.id}>
                    {m.description} · {Number(m.quantity)} {m.unit || ""} · {m.reason}
                  </li>
                ))}
              </ul>
              <Can permission="production.record_extra_materials">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Material"
                    value={extraDraft.description}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, description: e.target.value }))
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="Cantidad"
                    value={extraDraft.quantity}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, quantity: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Unidad"
                    value={extraDraft.unit}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, unit: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Motivo"
                    value={extraDraft.reason}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, reason: e.target.value }))
                    }
                  />
                  <Button size="sm" loading={acting} onClick={() => saveExtraMaterial(item.id)}>
                    Registrar material
                  </Button>
                </div>
              </Can>
            </div>
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="subtle"
                as="a"
                href={`/api/produccion/${productionId}/pdf/control-dimensional?itemId=${item.id}`}
                target="_blank"
              >
                <FileText className="h-4 w-4" /> Control dimensional
              </Button>
              <Button
                size="sm"
                variant="subtle"
                as="a"
                href={`/api/produccion/${productionId}/pdf/orden-trabajo?itemId=${item.id}`}
                target="_blank"
              >
                <FileText className="h-4 w-4" /> Orden de trabajo
              </Button>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Planos / archivos de cotizacion</p>
              {!(quoteDocs || []).length ? (
                <p className="text-sm text-content-muted">
                  Sin documentos tecnicos de produccion en la cotizacion.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {quoteDocs.map((file) => (
                    <li key={file.id}>
                      <a
                        className="text-brand-700 hover:underline"
                        href={`/api/blob?pathname=${encodeURIComponent(file.pathname)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.fileName}
                      </a>
                      {file.itemLabel ? (
                        <span className="text-content-muted"> · {file.itemLabel}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "calidad" && (
          <Can
            permission="quality.view"
            fallback={
              <p className="text-sm text-content-muted">
                No tienes permiso para ver calidad.
              </p>
            }
          >
            <ProductionQualityTab productionId={productionId} item={item} />
          </Can>
        )}

        {tab === "planeacion" && (
          <Can
            permission="production.manage_planning"
            fallback={
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-content-muted">Prioridad</dt>
                  <dd>{PRODUCTION_PRIORITY_LABELS[item.priority] || item.priority}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Responsable</dt>
                  <dd>{item.assignedToUser?.name || "-"}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Inicio planeado</dt>
                  <dd>{formatDate(item.plannedStartAt)}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Fin planeado</dt>
                  <dd>{formatDate(item.plannedEndAt)}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Compromiso</dt>
                  <dd>{formatDate(item.commitmentDate)}</dd>
                </div>
              </dl>
            }
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                savePlanning(item.id, {
                  assignedToUserId: fd.get("assignedToUserId") || null,
                  priority: fd.get("priority"),
                  plannedStartAt: fd.get("plannedStartAt") || null,
                  plannedEndAt: fd.get("plannedEndAt") || null,
                  commitmentDate: fd.get("commitmentDate") || null,
                  reason: fd.get("reason") || "Actualizacion de planeacion",
                });
              }}
            >
              <p className="sm:col-span-2 text-xs text-content-muted">
                Planeacion de esta partida: fechas de piso (inicio/fin) frente a la
                fecha de compromiso con el cliente. Si reprogramas, indica el motivo.
              </p>
              <Field label="Responsable" htmlFor={`plan-resp-${item.id}`}>
                <Select
                  id={`plan-resp-${item.id}`}
                  name="assignedToUserId"
                  defaultValue={item.assignedToUserId || ""}
                >
                  <option value="">Sin responsable</option>
                  {assignables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioridad" htmlFor={`plan-prio-${item.id}`}>
                <Select
                  id={`plan-prio-${item.id}`}
                  name="priority"
                  defaultValue={item.priority || "NORMAL"}
                >
                  {PRODUCTION_ITEM_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCTION_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Inicio planeado" htmlFor={`plan-start-${item.id}`}>
                <Input
                  id={`plan-start-${item.id}`}
                  type="date"
                  name="plannedStartAt"
                  defaultValue={toDateInputValue(item.plannedStartAt)}
                />
              </Field>
              <Field label="Fin planeado" htmlFor={`plan-end-${item.id}`}>
                <Input
                  id={`plan-end-${item.id}`}
                  type="date"
                  name="plannedEndAt"
                  defaultValue={toDateInputValue(item.plannedEndAt)}
                />
              </Field>
              <Field label="Fecha compromiso" htmlFor={`plan-commit-${item.id}`}>
                <Input
                  id={`plan-commit-${item.id}`}
                  type="date"
                  name="commitmentDate"
                  defaultValue={toDateInputValue(item.commitmentDate)}
                />
              </Field>
              <Field
                label="Motivo de reprogramacion"
                htmlFor={`plan-reason-${item.id}`}
              >
                <Input
                  id={`plan-reason-${item.id}`}
                  name="reason"
                  placeholder="Obligatorio si cambias fechas"
                />
              </Field>
              <div className="sm:col-span-2">
                <Button size="sm" type="submit" loading={acting}>
                  Guardar planeacion
                </Button>
              </div>
            </form>
          </Can>
        )}
      </div>
    </div>
  );
}

