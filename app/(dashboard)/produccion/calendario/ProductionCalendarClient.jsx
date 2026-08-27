"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/forms/Field";
import { MonthCalendar } from "@/components/views/MonthCalendar";
import { Badge } from "@/components/ui/Badge";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
  PRODUCTION_STATUSES,
} from "@/domains/production/constants";
import {
  addDays,
  defaultAgendaWindow,
  resolveScheduleSpan,
  toDay,
} from "@/domains/production/schedule-utils";

function emptyFilters() {
  const win = defaultAgendaWindow();
  return {
    from: win.from,
    to: win.to,
    clientId: "",
    sellerId: "",
    processId: "",
    status: "",
    datedOnly: true,
  };
}

function calendarDateFor(item) {
  const span = resolveScheduleSpan(item);
  return (
    item.commitmentDate ||
    item.plannedEndAt ||
    item.productionOrder?.estimatedDeliveryDate ||
    item.plannedStartAt ||
    span.end ||
    span.start
  );
}

export default function ProductionCalendarClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("month");
  const [filters, setFilters] = useState(emptyFilters);
  const [clients, setClients] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [processes, setProcesses] = useState([]);

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
      const data = await api.get(
        `/api/produccion/agenda${toQuery({
          from: f.from,
          to: f.to,
          clientId: f.clientId || undefined,
          sellerId: f.sellerId || undefined,
          processId: f.processId || undefined,
          status: f.status || undefined,
          datedOnly: f.datedOnly ? "1" : undefined,
        })}`
      );
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(emptyFilters());
  }, [load]);

  const dated = useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((item) => ({
        ...item,
        calendarDate: calendarDateFor(item),
        stageLabel: item.currentStage?.name || "Sin etapa",
      })),
    [rows]
  );

  const today = new Date().toISOString().slice(0, 10);
  const delayed = dated.filter(
    (r) =>
      r.calendarDate &&
      String(r.calendarDate).slice(0, 10) < today &&
      r.status !== "COMPLETED"
  );
  const urgent = dated.filter((r) => r.priority === "URGENT" && r.status !== "COMPLETED");

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    return toDay(d.toISOString());
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const byWeekDay = useMemo(() => {
    const map = new Map(weekDays.map((d) => [d, []]));
    for (const row of dated) {
      const key = toDay(row.calendarDate);
      if (key && map.has(key)) map.get(key).push(row);
    }
    return map;
  }, [dated, weekDays]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendario de produccion"
        description="Compromisos y fechas planeadas. Cada tarjeta muestra la etapa (proceso) calendarizada."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "month" ? "primary" : "secondary"}
              onClick={() => setMode("month")}
            >
              Mes
            </Button>
            <Button
              size="sm"
              variant={mode === "week" ? "primary" : "secondary"}
              onClick={() => setMode("week")}
            >
              Semana
            </Button>
            <Button as={Link} href="/produccion/gantt" size="sm" variant="subtle">
              Abrir Gantt
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Field label="Desde" htmlFor="cal-from">
            <Input
              id="cal-from"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>
          <Field label="Hasta" htmlFor="cal-to">
            <Input
              id="cal-to"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
          <Field label="Cliente" htmlFor="cal-client">
            <Select
              id="cal-client"
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
          <Field label="Vendedor" htmlFor="cal-seller">
            <Select
              id="cal-seller"
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
          <Field label="Proceso / servicio" htmlFor="cal-process">
            <Select
              id="cal-process"
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
          <Field label="Estatus" htmlFor="cal-status">
            <Select
              id="cal-status"
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
          <label className="flex items-center gap-2 text-sm">
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
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <p className="font-semibold">Atrasadas</p>
          <p className="text-2xl">{delayed.length}</p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="font-semibold">Urgentes</p>
          <p className="text-2xl">{urgent.length}</p>
        </Card>
      </div>

      {mode === "month" ? (
        <MonthCalendar
          rows={dated}
          loading={loading}
          getDate={(r) => r.calendarDate}
          getHref={(r) => `/produccion/${r.productionOrder.id}`}
          getTitle={(r) => r.productionOrder.folio}
          getSubtitle={(r) =>
            `${r.stageLabel} · ${r.description} · ${
              PRODUCTION_STATUS_LABELS[r.status] || r.status
            }`
          }
          emptyTitle="Sin partidas"
          emptyDescription="No hay partidas con fecha compromiso, planeada o entrega aproximada."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid gap-px bg-border sm:grid-cols-7">
            {weekDays.map((d) => {
              const items = byWeekDay.get(d) || [];
              const label = new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <div key={d} className="min-h-[160px] bg-white p-2">
                  <p
                    className={`mb-2 text-xs font-semibold ${
                      d === today ? "text-brand-700" : "text-content-muted"
                    }`}
                  >
                    {label}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/produccion/${r.productionOrder.id}`}
                          className="block rounded-md border border-border bg-surface-muted/50 px-2 py-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
                        >
                          <p className="text-xs font-semibold text-brand-800">
                            {r.productionOrder.folio}
                          </p>
                          <p className="truncate text-[11px] text-content-muted">
                            {r.description}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge tone="brand">{r.stageLabel}</Badge>
                            <Badge tone={PRODUCTION_STATUS_TONES[r.status] || "neutral"}>
                              {PRODUCTION_STATUS_LABELS[r.status] || r.status}
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    ))}
                    {!items.length ? (
                      <li className="text-[11px] text-content-muted">Sin eventos</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
