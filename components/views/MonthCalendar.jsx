"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toDayKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthCells(monthDate) {
  const first = startOfMonth(monthDate);
  // Monday-based week
  const jsDay = first.getDay(); // 0 Sun
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/**
 * Calendario mensual de solo lectura.
 * @param {(row)=>string|Date|null} getDate
 * @param {(row)=>string} getHref
 * @param {(row)=>string} getTitle
 * @param {(row)=>string} [getSubtitle]
 * @param {(row)=>string} [getTone]
 */
export function MonthCalendar({
  rows,
  getDate,
  getHref,
  getTitle,
  getSubtitle,
  getTone,
  loading,
  error,
  emptyTitle = "Sin registros",
  emptyDescription = "No hay elementos con fecha para este mes.",
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState(null);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = toDayKey(getDate(row));
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }, [rows, getDate]);

  const monthLabel = cursor.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  const selectedRows = selectedKey ? byDay.get(selectedKey) || [] : [];

  if (error) {
    return (
      <Alert variant="danger" title="Error al cargar">
        {error}
      </Alert>
    );
  }

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-[var(--radius-lg)]" />;
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCursor((d) => addMonths(d, -1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold capitalize text-content">
          {monthLabel}
        </h3>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCursor((d) => addMonths(d, 1))}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-surface-muted/40 text-center text-xs font-semibold uppercase tracking-wide text-content-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const key = toDayKey(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const items = byDay.get(key) || [];
          const isSelected = selectedKey === key;
          const isToday = toDayKey(new Date()) === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={cn(
                "min-h-[88px] border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0",
                !inMonth && "bg-surface-muted/20 text-content-muted",
                isSelected && "bg-brand-50",
                "hover:bg-surface-muted/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday && "bg-brand-600 text-white"
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                      getTone?.(row) === "event"
                        ? "bg-warning-100 text-warning-800"
                        : "bg-brand-100/80 text-brand-800"
                    )}
                    title={getTitle(row)}
                  >
                    {getTitle(row)}
                  </div>
                ))}
                {items.length > 3 ? (
                  <p className="px-1 text-[10px] text-content-muted">
                    +{items.length - 3} mas
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
          {selectedKey
            ? `Eventos del ${formatDate(selectedKey)}`
            : "Selecciona un dia"}
        </p>
        {!selectedKey ? (
          <p className="text-sm text-content-muted">
            Haz clic en un dia para ver el detalle.
          </p>
        ) : selectedRows.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {selectedRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    const href = getHref?.(row);
                    if (href) router.push(href);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-surface-muted/60"
                >
                  <span className="text-sm font-medium text-brand-700">
                    {getTitle(row)}
                  </span>
                  {getSubtitle ? (
                    <span className="text-xs text-content-muted">
                      {getSubtitle(row)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MonthCalendar;
