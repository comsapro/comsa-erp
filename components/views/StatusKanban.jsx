"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Alert } from "@/components/feedback/Alert";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Tablero kanban de solo lectura por estatus.
 * @param {object} props
 * @param {Array<{id:string,label:string,tone?:string}>} props.columns
 * @param {Array} props.rows
 * @param {(row)=>string} props.getStatus
 * @param {(row)=>string} props.getHref
 * @param {(row)=>string} props.getTitle
 * @param {(row)=>string} [props.getSubtitle]
 * @param {(row)=>string|null} [props.getDate]
 * @param {(row)=>{amount:any,currency?:string}|null} [props.getTotal]
 * @param {boolean} [props.loading]
 * @param {string|null} [props.error]
 */
export function StatusKanban({
  columns,
  rows,
  getStatus,
  getHref,
  getTitle,
  getSubtitle,
  getDate,
  getTotal,
  loading,
  error,
  emptyTitle = "Sin registros",
  emptyDescription = "No hay elementos para mostrar en el tablero.",
}) {
  const router = useRouter();

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c.id, []]));
    for (const row of rows) {
      const status = getStatus(row);
      if (map[status]) map[status].push(row);
      else if (map._other) map._other.push(row);
    }
    return map;
  }, [columns, rows, getStatus]);

  if (error) {
    return (
      <Alert variant="danger" title="Error al cargar">
        {error}
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div
            key={col.id}
            className="w-72 shrink-0 rounded-[var(--radius-lg)] border border-border bg-surface-muted/40 p-3"
          >
            <Skeleton className="mb-3 h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const totalCards = rows.length;
  if (totalCards === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-white">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const cards = grouped[col.id] || [];
        return (
          <div
            key={col.id}
            className="flex w-72 shrink-0 flex-col rounded-[var(--radius-lg)] border border-border bg-surface-muted/30"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Badge tone={col.tone || "neutral"}>{col.label}</Badge>
              </div>
              <span className="text-xs font-medium text-content-muted">
                {cards.length}
              </span>
            </div>
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
              {cards.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-content-muted">
                  Vacio
                </p>
              ) : (
                cards.map((row) => {
                  const total = getTotal?.(row);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => router.push(getHref(row))}
                      className={cn(
                        "rounded-[var(--radius-md)] border border-border bg-white p-3 text-left shadow-sm",
                        "transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                      )}
                    >
                      <p className="text-sm font-semibold text-brand-700">
                        {getTitle(row)}
                      </p>
                      {getSubtitle && (
                        <p className="mt-1 line-clamp-2 text-xs text-content">
                          {getSubtitle(row)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-muted">
                        {getDate && getDate(row) ? (
                          <span>{formatDate(getDate(row))}</span>
                        ) : null}
                        {total ? (
                          <span className="font-medium text-content">
                            {formatMoney(total.amount, total.currency || "MXN")}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatusKanban;
