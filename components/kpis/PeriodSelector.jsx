"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import {
  MONTH_NAMES,
  PERIOD_TYPES,
  monthRange,
  resolvePeriod,
  todayKey,
} from "@/domains/kpis/periods";

/** Normaliza los parametros para que siempre lleven sus sub-campos. */
export function normalizePeriodParams(params = {}) {
  const resolved = resolvePeriod(params);
  const today = todayKey();
  const [ty, tm] = today.split("-").map(Number);
  return {
    period: resolved.type,
    year: Number(params.year) || ty,
    month: Number(params.month) || tm,
    quarter: Number(params.quarter) || Math.ceil(tm / 3),
    half: Number(params.half) || (tm <= 6 ? 1 : 2),
    from: params.from || monthRange(ty, tm).from,
    to: params.to || today,
    date: params.date || today,
  };
}

/** Solo los parametros que aplican al tipo de periodo (para la URL / API). */
export function periodApiParams(state) {
  switch (state.period) {
    case "month_pick":
      return { period: state.period, year: state.year, month: state.month };
    case "quarter":
      return { period: state.period, year: state.year, quarter: state.quarter };
    case "semester":
      return { period: state.period, year: state.year, half: state.half };
    case "year":
      return { period: state.period, year: state.year };
    case "week":
      return { period: state.period, date: state.date };
    case "custom":
      return { period: state.period, from: state.from, to: state.to };
    default:
      return { period: state.period };
  }
}

export function PeriodSelector({ value, onChange, compact = false }) {
  const resolved = useMemo(() => resolvePeriod(periodApiParams(value)), [value]);
  const currentYear = Number(todayKey().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-content-muted">Periodo</span>
        <Select
          className="h-9 w-44!"
          value={value.period}
          onChange={(e) => set({ period: e.target.value })}
          aria-label="Tipo de periodo"
        >
          {PERIOD_TYPES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </label>

      {value.period === "month_pick" && (
        <Select
          className="h-9 w-36!"
          value={value.month}
          onChange={(e) => set({ month: Number(e.target.value) })}
          aria-label="Mes"
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      )}
      {value.period === "quarter" && (
        <Select
          className="h-9 w-24!"
          value={value.quarter}
          onChange={(e) => set({ quarter: Number(e.target.value) })}
          aria-label="Trimestre"
        >
          {[1, 2, 3, 4].map((q) => (
            <option key={q} value={q}>
              Q{q}
            </option>
          ))}
        </Select>
      )}
      {value.period === "semester" && (
        <Select
          className="h-9 w-24!"
          value={value.half}
          onChange={(e) => set({ half: Number(e.target.value) })}
          aria-label="Semestre"
        >
          <option value={1}>H1</option>
          <option value={2}>H2</option>
        </Select>
      )}
      {["month_pick", "quarter", "semester", "year"].includes(value.period) && (
        <Select
          className="h-9 w-24!"
          value={value.year}
          onChange={(e) => set({ year: Number(e.target.value) })}
          aria-label="Año"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      )}
      {value.period === "week" && (
        <Input
          type="date"
          className="h-9 w-40!"
          value={value.date}
          onChange={(e) => e.target.value && set({ date: e.target.value })}
          aria-label="Cualquier dia de la semana"
        />
      )}
      {value.period === "custom" && (
        <>
          <Input
            type="date"
            className="h-9 w-40!"
            value={value.from}
            onChange={(e) => e.target.value && set({ from: e.target.value })}
            aria-label="Desde"
          />
          <Input
            type="date"
            className="h-9 w-40!"
            value={value.to}
            onChange={(e) => e.target.value && set({ to: e.target.value })}
            aria-label="Hasta"
          />
        </>
      )}

      {!compact && (
        <p className="flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-50 px-3 text-sm font-medium text-brand-700">
          <CalendarRange className="h-4 w-4" aria-hidden />
          Periodo seleccionado: {resolved.label}
        </p>
      )}
    </div>
  );
}

export default PeriodSelector;
