"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/utils/format";

/**
 * Variacion contra el periodo anterior. `goodWhen` indica si subir es bueno
 * ("up") o malo ("down", p. ej. errores o dias de cobro).
 */
export function DeltaBadge({ delta, format = "number", goodWhen = "up", suffix = "", className }) {
  if (!delta || delta.diff == null) {
    return <span className={cn("text-xs text-content-muted", className)}>Sin comparativo</span>;
  }
  const { diff, previous } = delta;
  const neutral = diff === 0;
  const good = neutral ? null : goodWhen === "up" ? diff > 0 : diff < 0;
  const Icon = neutral ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const fmt = (v) =>
    format === "money" ? formatMoney(v) : format === "percent" ? `${Number(v).toFixed(1)}%` : `${v}${suffix}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        neutral ? "text-content-muted" : good ? "text-success-700" : "text-danger-700",
        className
      )}
      title={`Periodo anterior: ${previous == null ? "—" : fmt(previous)}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {diff > 0 ? "+" : ""}
      {fmt(diff)}
      <span className="font-normal text-content-muted">vs anterior</span>
    </span>
  );
}

export function Stat({ label, value, hint, tone = "default", children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-content-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-xl font-semibold tabular-nums",
          tone === "danger" ? "text-danger-700" : tone === "success" ? "text-success-700" : "text-content"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-content-muted">{hint}</p>}
      {children}
    </div>
  );
}

export function ProgressBar({ percent, label = "Avance", className }) {
  const value = percent == null ? 0 : Number(percent);
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2.5 overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-200", value >= 100 ? "bg-success-500" : "bg-brand-600")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1 border-b border-border", className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-content-muted hover:text-content"
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  t.alert && t.count > 0 ? "bg-danger-50 text-danger-700" : "bg-surface-muted text-content-muted"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tabla simple responsiva. columns: [{ key, header, render(row), align, className }] */
export function SimpleTable({ columns, rows, empty = "Sin registros.", rowKey = (r) => r.id, footer, dense = false }) {
  if (!rows?.length) {
    return <p className="px-1 py-6 text-center text-sm text-content-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn("whitespace-nowrap px-2 py-2 font-medium", c.align === "right" && "text-right", c.headerClassName)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => (
            <tr key={rowKey(row, idx)} className="align-top hover:bg-surface-muted/50">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    dense ? "px-2 py-1.5" : "px-2 py-2",
                    c.align === "right" && "text-right tabular-nums",
                    c.className
                  )}
                >
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}

/** Tarjeta de grafica con alternador a vista de tabla (accesibilidad). */
export function ChartCard({ title, description, actions, table, children, className }) {
  const [mode, setMode] = useState("chart");
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-content">{title}</h3>
          {description && <p className="text-xs text-content-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === "chart" ? "table" : "chart"))}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs text-content-muted hover:bg-surface-muted"
              aria-label={mode === "chart" ? "Ver como tabla" : "Ver como grafica"}
            >
              {mode === "chart" ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
              {mode === "chart" ? "Tabla" : "Gráfica"}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-5">{mode === "table" && table ? table : children}</div>
    </Card>
  );
}

/**
 * Barras horizontales de un solo tono (magnitud). Etiquetas y valores en tinta
 * de texto; la barra solo codifica la magnitud. rows: [{ key, label, value, display, detail }]
 */
export function HBarChart({ rows, empty = "Sin datos en el periodo.", max }) {
  const [hover, setHover] = useState(null);
  if (!rows?.length) return <p className="py-6 text-center text-sm text-content-muted">{empty}</p>;
  const top = max ?? Math.max(...rows.map((r) => Number(r.value) || 0), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = Math.max(0, ((Number(r.value) || 0) / top) * 100);
        const active = hover === r.key;
        return (
          <li
            key={r.key}
            className="relative grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
            onMouseEnter={() => setHover(r.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="truncate text-sm text-content" title={r.label}>
              {r.label}
            </span>
            <span className="relative h-5">
              <span className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-surface-muted" aria-hidden />
              <span
                className={cn(
                  "absolute inset-y-[5px] left-0 rounded-full transition-[width,opacity] duration-200",
                  r.tone === "danger" ? "bg-danger-500" : "bg-brand-600",
                  hover && !active && "opacity-50"
                )}
                style={{ width: `${Math.max(pct, r.value > 0 ? 1.5 : 0)}%` }}
                aria-hidden
              />
            </span>
            <span className="text-right text-sm tabular-nums text-content">{r.display ?? r.value}</span>
            {active && r.detail && (
              <span className="pointer-events-none absolute left-36 top-full z-10 mt-1 rounded-[var(--radius-sm)] border border-border bg-white px-2.5 py-1.5 text-xs text-content shadow-[var(--shadow-pop)] sm:left-48">
                {r.detail}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Columnas verticales por periodo (semana/mes) con tooltip al pasar el cursor.
 * bars: [{ key, label, value, display, muted }]
 */
export function ColumnChart({ bars, height = 180, formatValue = (v) => v, empty = "Sin datos." }) {
  const [hover, setHover] = useState(null);
  if (!bars?.length) return <p className="py-6 text-center text-sm text-content-muted">{empty}</p>;
  const top = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const grid = [1, 0.5];
  return (
    <div className="relative" style={{ height: height + 28 }}>
      <div className="absolute inset-x-0 top-0" style={{ height }}>
        {grid.map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ top: `${(1 - g) * 100}%` }}
          >
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] tabular-nums text-content-muted">
              {formatValue(top * g)}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-end gap-[2px] pl-14" style={{ height }}>
        {bars.map((b) => {
          const h = ((Number(b.value) || 0) / top) * height;
          const active = hover === b.key;
          return (
            <button
              key={b.key}
              type="button"
              className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
              onMouseEnter={() => setHover(b.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(b.key)}
              onBlur={() => setHover(null)}
              aria-label={`${b.label}: ${b.display ?? formatValue(b.value)}`}
            >
              <span
                className={cn(
                  "w-full max-w-10 rounded-t-[4px] transition-opacity duration-150",
                  b.muted ? "bg-brand-200" : "bg-brand-600",
                  hover && !active && "opacity-50"
                )}
                style={{ height: Math.max(h, b.value > 0 ? 2 : 0) }}
              />
              {active && (
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[var(--radius-sm)] border border-border bg-white px-2.5 py-1.5 text-xs text-content shadow-[var(--shadow-pop)]">
                  <span className="block font-medium">{b.label}</span>
                  <span className="tabular-nums">{b.display ?? formatValue(b.value)}</span>
                  {b.detail && <span className="block text-content-muted">{b.detail}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-[2px] pl-14">
        {bars.map((b) => (
          <span key={b.key} className="flex-1 truncate text-center text-[10px] text-content-muted">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function compactMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
}

export function formatDays(value) {
  return value == null ? "—" : `${value} días`;
}

export function formatPct(value) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}
