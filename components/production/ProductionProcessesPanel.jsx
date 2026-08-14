"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Can } from "@/components/permissions/Can";
import { itemHoursSummary, canDeleteProductionProcess } from "@/domains/production/process-rules";

const PROCESS_STATUS = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  REPLACED: "Reemplazado",
};

export function ProductionProcessesPanel({
  productionId,
  item,
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

  return (
    <div className="rounded-[var(--radius-md)] border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Procesos</p>
        <p className="text-xs text-content-muted">
          Cotizado {summary.quotedHours} h · Real {summary.realHours} h · Dif{" "}
          {summary.difference} h
        </p>
      </div>

      {!processes.length ? (
        <p className="text-sm text-content-muted">Sin procesos. Agrega desde el catalogo.</p>
      ) : (
        <ul className="space-y-2">
          {processes.map((proc) => (
            <li
              key={proc.id}
              className="rounded-md bg-surface-muted/60 p-2 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {proc.processNameSnapshot}{" "}
                    <span className="text-xs font-normal text-content-muted">
                      {proc.sourceType === "QUOTATION" ? "Cotizacion" : "Produccion"} ·{" "}
                      {PROCESS_STATUS[proc.status] || proc.status}
                    </span>
                  </p>
                  <p className="text-xs text-content-muted">
                    Cotizado {Number(proc.quotedHours) || 0} h · Esperado{" "}
                    {Number(proc.expectedHours) || 0} h
                    {proc.replacementReason
                      ? ` · Reemplazo: ${proc.replacementReason}`
                      : ""}
                  </p>
                </div>
              </div>

              {proc.status !== "REPLACED" && canManage && (
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
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
                      {proc.status !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={acting}
                          onClick={() => onChanged("complete-process", proc.id)}
                        >
                          Completar proceso
                        </Button>
                      )}
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
                  <Can permission="production.manage_processes">
                    <div className="sm:col-span-4 grid gap-2 sm:grid-cols-3">
                      <select
                        className="rounded-md border border-border bg-white px-2 py-2 text-sm"
                        value={replaceDraft[proc.id]?.processId || ""}
                        onChange={(e) =>
                          setReplaceDraft((prev) => ({
                            ...prev,
                            [proc.id]: {
                              ...(prev[proc.id] || {}),
                              processId: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Reemplazar por...</option>
                        {catalog.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.code} · {opt.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Motivo del reemplazo"
                        value={replaceDraft[proc.id]?.reason || ""}
                        onChange={(e) =>
                          setReplaceDraft((prev) => ({
                            ...prev,
                            [proc.id]: {
                              ...(prev[proc.id] || {}),
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
                          onChanged("replace-process", proc.id, {
                            manufacturingProcessId:
                              replaceDraft[proc.id]?.processId,
                            reason: replaceDraft[proc.id]?.reason,
                          })
                        }
                      >
                        Reemplazar
                      </Button>
                    </div>
                  </Can>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <Can permission="production.manage_processes">
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <select
              className="rounded-md border border-border bg-white px-2 py-2 text-sm"
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
            >
              <option value="">Agregar proceso no cotizado</option>
              {catalog.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.code} · {opt.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="0.001"
              placeholder="Horas esperadas"
              value={expectedHours}
              onChange={(e) => setExpectedHours(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={acting}
              onClick={() => {
                onChanged("add-process", null, {
                  manufacturingProcessId: processId,
                  expectedHours: Number(expectedHours || 0),
                });
                setProcessId("");
                setExpectedHours("");
              }}
            >
              Agregar
            </Button>
          </div>
        </Can>
      )}
    </div>
  );
}

export default ProductionProcessesPanel;
