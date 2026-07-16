"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Pagination({ pagination, onPageChange, loading }) {
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-content-muted">
        Mostrando <span className="font-medium text-content">{from}</span>-
        <span className="font-medium text-content">{to}</span> de{" "}
        <span className="font-medium text-content">{total}</span> registros
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-white px-3 text-sm text-content transition-colors hover:bg-surface-muted",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="px-3 text-sm text-content-muted">
          Pagina {page} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-white px-3 text-sm text-content transition-colors hover:bg-surface-muted",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
