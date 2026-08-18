"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { HoursBar } from "@/components/production/HoursBar";
import { Can } from "@/components/permissions/Can";
import {
  itemHoursSummary,
  canDeleteProductionProcess,
} from "@/domains/production/process-rules";

const PROCESS_STATUS = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  REPLACED: "Reemplazado",
};

export function ProductionProcessesPanel({
  productionId,
  item,
  assignables = [],
  canManage,
  acting,
  onChanged,
}) {
  const [catalog, setCatalog] = useState([]);
  const [processId, setProcessId] = useState("");
  const [expectedHours, setExpectedHours] = useState("");
  const [hoursDraft, setHoursDraft] = useState({});
  const [replaceDraft, setReplaceDraft] = useState({});

  useEffect(() => {
    if (!canManage) return;
    api
      .get("/api/produccion/procesos-catalogo")
      .then((rows) => setCatalog(Array.isArray(rows) ? rows : rows?.data || []))
      .catch(() => setCatalog([]));
  }, [canManage]);

  useEffect(() => {
    const next = {};
    for (const p of item.processes || []) {
      next[p.id] = String(Number(p.realHours) || 0);
    }
    setHoursDraft(next);
  }, [item.processes]);

  const summary = itemHoursSummary(item.processes || []);
  const processes = item.processes || [];
  const nextPending = processes.find((p) => p.status === "PENDING");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Procesos</p>
          <p className="text-xs text-content-muted">
            El siguiente pendiente se destaca para el operador de piso.
          </p>
        </div>
        <HoursBar
          quotedHours={summary.quotedHours}
          expectedHours={summary.expectedHours}
          realHours={summary.realHours}
        />
      </div>

      {!processes.length ? (
        <p className="text-sm text-content-muted">
          Sin procesos. Agrega desde el catalogo.
        </p>
      ) : (
        <ol className="space-y-2">
          {processes.map((proc, index) => {
            const running = (proc.sessions || []).find((s) => s.status === "RUNNING");
            const paused = (proc.sessions || []).find((s) => s.status === "PAUSED");
            const highlighted = nextPending?.id === proc.id;
            return (
              <li
                key={proc.id}
                className={`rounded-md border p-3 text-sm ${
                  highlighted
                    ? "border-brand-600 bg-brand-50/60"
                    : "border-border bg-surface-muted/40"
                } ${proc.status === "REPLACED" ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {index + 1}. {proc.processNameSnapshot}{" "}
                      <span className="text-xs font-normal text-content-muted">
                        {proc.sourceType === "QUOTATION" ? "Cotizacion" : "Piso"} ·{" "}
                        {PROCESS_STATUS[proc.status] || proc.status}
                        {running ? " · En curso" : ""}
                        {paused && !running ? " · Pausado" : ""}
                      </span>
                    </p>
                    <p className="text-xs text-content-muted">
                      {proc.assignedToUser?.name
                        ? `Resp. ${proc.assignedToUser.name}`
                        : "Sin responsable"}
                      {proc.replacementReason
                        ? ` · Reemplazo: ${proc.replacementReason}`
                        : ""}
                    </p>
                  </div>
                  <HoursBar
                    compact
                    quotedHours={proc.quotedHours}
                    expectedHours={proc.expectedHours}
                    realHours={proc.realHours}
                  />
                </div>

                {proc.status !== "REPLACED" && proc.status !== "COMPLETED" && (
                  <div className="mt-3 space-y-2">
                    <Can permission="production.assign_responsible">
                      <Select
                        value={proc.assignedToUserId || ""}
                        onChange={(e) =>
                          onChanged("assign-process", proc.id, {
                            assignedToUserId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Responsable del proceso</option>
                        {assignables.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                    </Can>
                    <Can permission="production.record_sessions">
                      <div className="flex flex-wrap gap-2">
                        {!running && !paused && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={acting}
                            onClick={() => onChanged("session-start", proc.id)}
                          >
                            Iniciar
                          </Button>
                        )}
                        {running && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={acting}
                              onClick={() => onChanged("session-pause", proc.id)}
                            >
                              Pausar
                            </Button>
                            <Button
                              size="sm"
                              loading={acting}
                              onClick={() => onChanged("session-end", proc.id)}
                            >
                              Finalizar sesion
                            </Button>
                          </>
                        )}
                        {paused && !running && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={acting}
                              onClick={() => onChanged("session-resume", proc.id)}
                            >
                              Reanudar
                            </Button>
                            <Button
                              size="sm"
                              loading={acting}
                              onClick={() => onChanged("session-end", proc.id)}
                            >
                              Finalizar sesion
                            </Button>
                          </>
                        )}
                      </div>
                    </Can>
                    {canManage && (
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Can permission="production.record_process_hours">
                          <div>
                            <label className="mb-1 block text-xs text-content-muted">
                              Horas reales
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={hoursDraft[proc.id] ?? ""}
                              onChange={(e) =>
                                setHoursDraft((prev) => ({
                                  ...prev,
                                  [proc.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </Can>
                        <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
                          <Can permission="production.record_process_hours">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={acting}
                              onClick={() =>
                                onChanged("hours", proc.id, {
                                  realHours: Number(hoursDraft[proc.id] || 0),
                                })
                              }
                            >
                              Guardar horas
                            </Button>
                          </Can>
                          <Can permission="production.record_process_hours">
                            <Button
                              size="sm"
                              loading={acting}
                              onClick={() => onChanged("complete-process", proc.id)}
                            >
                              Completar proceso
                            </Button>
                          </Can>
                          {canDeleteProductionProcess(proc) && (
                            <Can permission="production.manage_processes">
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={acting}
                                onClick={() => onChanged("delete-process", proc.id)}
                              >
                                Quitar
                              </Button>
                            </Can>
                          )}
                        </div>
                      </div>
                    )}
                    <Can permission="production.manage_processes">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Select
                          value={replaceDraft[proc.id]?.manufacturingProcessId || ""}
                          onChange={(e) =>
                            setReplaceDraft((prev) => ({
                              ...prev,
                              [proc.id]: {
                                ...prev[proc.id],
                                manufacturingProcessId: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Sustituir por...</option>
                          {catalog.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </Select>
                        <Input
                          placeholder="Motivo del reemplazo"
                          value={replaceDraft[proc.id]?.reason || ""}
                          onChange={(e) =>
                            setReplaceDraft((prev) => ({
                              ...prev,
                              [proc.id]: {
                                ...prev[proc.id],
                                reason: e.target.value,
                              },
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={acting}
                          onClick={() =>
                            onChanged("replace-process", proc.id, replaceDraft[proc.id])
                          }
                        >
                          Sustituir
                        </Button>
                      </div>
                    </Can>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canManage && (
        <Can permission="production.manage_processes">
          <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-4">
            <Select
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
            >
              <option value="">Agregar proceso</option>
              {catalog.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              step="0.001"
              placeholder="Horas objetivo"
              value={expectedHours}
              onChange={(e) => setExpectedHours(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Button
                size="sm"
                variant="secondary"
                loading={acting}
                onClick={() =>
                  onChanged("add-process", null, {
                    manufacturingProcessId: processId,
                    expectedHours: expectedHours
                      ? Number(expectedHours)
                      : undefined,
                  })
                }
              >
                Agregar
              </Button>
            </div>
          </div>
        </Can>
      )}
    </div>
  );
}

