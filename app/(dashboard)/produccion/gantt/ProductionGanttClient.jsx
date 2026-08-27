"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/forms/Field";
import { Can } from "@/components/permissions/Can";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
  PRODUCTION_STATUSES,
} from "@/domains/production/constants";
import {
  addDays,
  buildDayRange,
  daysBetween,
  defaultAgendaWindow,
  resolveScheduleSpan,
  toDay,
} from "@/domains/production/schedule-utils";

const DAY_PX = 28;
const LABEL_W = 280;

function barTone(item) {
  if (item.status === "COMPLETED") return "bg-success-600";
  if (item.status === "REWORK") return "bg-warning-600";
  if (item.priority === "URGENT") return "bg-danger-600";
  if (item.priority === "HIGH") return "bg-warning-500";
  return "bg-brand-600";
}

function emptyFilters() {
  const win = defaultAgendaWindow();
  return {
    from: win.from,
    to: win.to,
    clientId: "",
    sellerId: "",
    processId: "",
    processName: "",
    status: "",
    datedOnly: true,
  };
}

export default function ProductionGanttClient() {
  const { toast } = useToast();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [clients, setClients] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [saving, setSaving] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api
        .get(
          `/api/clientes${toQuery({
            status: "ACTIVE",
            pageSize: 100,
            sort: "commercialName",
            order: "asc",
          })}`
        )
        .catch(() => ({ data: [] })),
      api
        .get(`/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`)
        .catch(() => ({ data: [] })),
      api
        .get(`/api/procesos${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`)
        .catch(() => ({ data: [] })),
    ]).then(([c, s, p]) => {
      setClients(c?.data || c?.items || (Array.isArray(c) ? c : []));
      setSellers(s?.data || s?.items || (Array.isArray(s) ? s : []));
      setProcesses(p?.data || p?.items || (Array.isArray(p) ? p : []));
    });
  }, []);

  const load = useCallback(async (f) => {
    setLoading(true);
    try {
      const params = {
        from: f.from,
        to: f.to,
        clientId: f.clientId || undefined,
        sellerId: f.sellerId || undefined,
        processId: f.processId || undefined,
        processName: f.processName || undefined,
        status: f.status || undefined,
        datedOnly: f.datedOnly ? "1" : undefined,
      };
      const data = await api.get(`/api/produccion/agenda${toQuery(params)}`);
      setRows(Array.isArray(data) ? data : []);
      setApplied(f);
    } catch {
      setRows([]);
      toast({ variant: "danger", title: "No se pudo cargar el Gantt" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(emptyFilters());
  }, [load]);

  const days = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    let from = applied.from || defaultAgendaWindow().from;
    let to = applied.to || defaultAgendaWindow().to;
    for (const item of list) {
      const span = resolveScheduleSpan(item);
      if (span.start && span.start < from) from = span.start;
      if (span.end && span.end > to) to = span.end;
    }
    // Limita a 120 dias: si el span es enorme, centra en la ventana aplicada.
    const built = buildDayRange(from, to, 120);
    if (built.length >= 120) {
      return buildDayRange(
        applied.from || defaultAgendaWindow().from,
        applied.to || defaultAgendaWindow().to,
        120
      );
    }
    return built;
  }, [rows, applied]);

  const visibleRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return list.map((item) => ({ item, span: resolveScheduleSpan(item) }));
  }, [rows]);

  const today = toDay(new Date().toISOString());

  const persistEnd = async (item, start, newEnd) => {
    setSaving(item.id);
    try {
      await api.patch(`/api/produccion/${item.productionOrder.id}/items/${item.id}`, {
        plannedStartAt: start,
        plannedEndAt: newEnd,
        reason: "Reprogramacion Gantt",
      });
      await load(applied);
      toast({ variant: "success", title: "Fechas actualizadas" });
    } catch (err) {
      toast({
        variant: "danger",
        title: "No se pudo reprogramar",
        description: err?.message,
      });
    } finally {
      setSaving(null);
    }
  };

  const onBarPointerDown = (e, item, span) => {
    if (!span.start || !span.end) return;
    e.preventDefault();
    const startX = e.clientX;
    const origEnd = span.end;
    dragRef.current = { item, span, startX, origEnd, mode: "end" };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const delta = Math.round((ev.clientX - startX) / DAY_PX);
      const preview = addDays(origEnd, delta);
      const nextEnd = preview < span.start ? span.start : preview;
      dragRef.current.previewEnd = nextEnd;
      setDragPreview({ itemId: item.id, end: nextEnd });
    };
    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const draft = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (!draft?.previewEnd || draft.previewEnd === origEnd) return;
      await persistEnd(item, span.start, draft.previewEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gantt de partidas"
        description="Tablero de planeacion por fechas. Arrastra el extremo derecho de la barra para reprogramar (supervisor)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} href="/produccion/calendario" variant="subtle" size="sm">
              Calendario
            </Button>
            <Button as={Link} href="/produccion" variant="secondary" size="sm">
              Ordenes
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Field label="Desde" htmlFor="gantt-from">
            <Input
              id="gantt-from"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>
          <Field label="Hasta" htmlFor="gantt-to">
            <Input
              id="gantt-to"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
          <Field label="Cliente" htmlFor="gantt-client">
            <Select
              id="gantt-client"
              value={filters.clientId}
              onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.commercialName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vendedor" htmlFor="gantt-seller">
            <Select
              id="gantt-seller"
              value={filters.sellerId}
              onChange={(e) => setFilters((f) => ({ ...f, sellerId: e.target.value }))}
            >
              <option value="">Todos</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proceso / servicio" htmlFor="gantt-process">
            <Select
              id="gantt-process"
              value={filters.processId}
              onChange={(e) => setFilters((f) => ({ ...f, processId: e.target.value }))}
            >
              <option value="">Todos</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estatus partida" htmlFor="gantt-status">
            <Select
              id="gantt-status"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Activas</option>
              {PRODUCTION_STATUSES.filter((s) => s !== "CANCELLED").map((s) => (
                <option key={s} value={s}>
                  {PRODUCTION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={filters.datedOnly}
              onChange={(e) =>
                setFilters((f) => ({ ...f, datedOnly: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Solo con fechas
          </label>
          <Button size="sm" loading={loading} onClick={() => load(filters)}>
            Aplicar filtros
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => {
              const next = emptyFilters();
              setFilters(next);
              load(next);
            }}
          >
            Limpiar
          </Button>
          <p className="text-xs text-content-muted">
            {visibleRows.length} partida{visibleRows.length === 1 ? "" : "s"} · {days.length}{" "}
            dias
          </p>
        </div>
      </Card>

      {loading && !rows ? (
        <Skeleton className="h-72 w-full" />
      ) : !visibleRows.length ? (
        <EmptyState
          title="Sin partidas en el rango"
          description="Ajusta fechas, desactiva «Solo con fechas» o asigna planeacion / entrega aproximada en la orden."
        />
      ) : (
        <Card className="overflow-hidden">
          {visibleRows.every(({ span }) => !span.start) ? (
            <div className="border-b border-border bg-warning-50 px-4 py-3 text-sm text-warning-700">
              Las partidas no tienen fechas de planeacion, compromiso ni entrega aproximada.
              Define la <strong>entrega aproximada</strong> en la orden de produccion (o planeacion
              por partida) para ver barras en el Gantt.
            </div>
          ) : null}
          <div className="overflow-auto">
            <div
              className="relative min-w-full"
              style={{ width: LABEL_W + days.length * DAY_PX }}
            >
              <div className="sticky top-0 z-20 flex border-b border-border bg-surface-muted">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-surface-muted px-3 py-2 text-xs font-semibold"
                  style={{ width: LABEL_W }}
                >
                  Partida
                </div>
                <div className="relative flex" style={{ width: days.length * DAY_PX }}>
                  {days.map((d) => {
                    const isToday = d === today;
                    const isMonday = new Date(`${d}T12:00:00`).getDay() === 1;
                    return (
                      <div
                        key={d}
                        className={`flex h-10 shrink-0 flex-col items-center justify-center border-r border-border/60 text-[10px] ${
                          isToday ? "bg-brand-50 font-semibold text-brand-800" : "text-content-muted"
                        } ${isMonday ? "border-l border-l-border" : ""}`}
                        style={{ width: DAY_PX }}
                        title={d}
                      >
                        <span>{d.slice(8, 10)}</span>
                        {isMonday ? (
                          <span className="text-[9px] uppercase">{d.slice(5, 7)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {visibleRows.map(({ item, span }) => {
                const previewEnd =
                  dragPreview?.itemId === item.id ? dragPreview.end : null;
                const end = previewEnd || span.end;
                const hasBar = Boolean(span.start && end && days.length);
                const startIdx = hasBar ? daysBetween(days[0], span.start) : 0;
                const endIdx = hasBar ? daysBetween(days[0], end) : 0;
                const outside =
                  hasBar && (endIdx < 0 || startIdx >= days.length);
                const left = Math.max(0, startIdx) * DAY_PX;
                const rightEdge = Math.min(days.length - 1, Math.max(startIdx, endIdx)) + 1;
                const width = Math.max(DAY_PX / 2, rightEdge * DAY_PX - left);

                return (
                  <div
                    key={item.id}
                    className="flex border-b border-border hover:bg-surface-muted/40"
                  >
                    <div
                      className="sticky left-0 z-10 flex shrink-0 flex-col gap-1 border-r border-border bg-white px-3 py-2"
                      style={{ width: LABEL_W }}
                    >
                      <Link
                        href={`/produccion/${item.productionOrder.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        {item.productionOrder.folio}
                      </Link>
                      <p className="line-clamp-2 text-xs text-content-muted">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={PRODUCTION_STATUS_TONES[item.status] || "neutral"}>
                          {PRODUCTION_STATUS_LABELS[item.status] || item.status}
                        </Badge>
                        {item.currentStage?.name ? (
                          <Badge tone="brand">{item.currentStage.name}</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-content-muted">
                        {item.productionOrder.client?.commercialName || "—"}
                        {(item.productionOrder.quote?.seller?.name ||
                          item.productionOrder.directOrder?.seller?.name)
                          ? ` · ${
                              item.productionOrder.quote?.seller?.name ||
                              item.productionOrder.directOrder?.seller?.name
                            }`
                          : ""}
                      </p>
                    </div>

                    <div
                      className="relative h-[76px]"
                      style={{
                        width: days.length * DAY_PX,
                        backgroundImage:
                          "repeating-linear-gradient(to right, transparent 0, transparent 27px, rgba(0,0,0,0.06) 27px, rgba(0,0,0,0.06) 28px)",
                      }}
                    >
                      {today && days.includes(today) ? (
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 w-px bg-brand-400/70"
                          style={{ left: daysBetween(days[0], today) * DAY_PX + DAY_PX / 2 }}
                        />
                      ) : null}
                      {hasBar && !outside && width > 0 ? (
                        <Can
                          permission="production.manage_planning"
                          fallback={
                            <div
                              className={`absolute top-5 h-7 rounded-md ${barTone(item)} opacity-90 shadow-sm`}
                              style={{ left, width }}
                              title={`${span.start} → ${end}`}
                            />
                          }
                        >
                          <div
                            role="presentation"
                            className={`absolute top-5 flex h-7 items-center rounded-md ${barTone(item)} text-[10px] font-medium text-white shadow-sm ${
                              saving === item.id ? "opacity-60" : ""
                            }`}
                            style={{ left, width }}
                            title={`${span.start} → ${end} (${span.source || "fecha"})`}
                          >
                            <span className="truncate px-2">
                              {item.currentStage?.name ||
                                PRODUCTION_STATUS_LABELS[item.status] ||
                                ""}
                            </span>
                            <button
                              type="button"
                              aria-label="Arrastrar fin para reprogramar"
                              className="ml-auto h-full w-2 cursor-ew-resize rounded-r-md bg-black/25 hover:bg-black/40"
                              disabled={!!saving}
                              onPointerDown={(e) => onBarPointerDown(e, item, span)}
                            />
                          </div>
                        </Can>
                      ) : (
                        <p className="absolute left-2 top-6 text-[11px] text-content-muted">
                          Sin fechas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {dragPreview?.end ? (
            <p className="border-t border-border px-3 py-2 text-xs text-content-muted">
              Nueva fecha fin: {dragPreview.end}
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
