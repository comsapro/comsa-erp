"use client";

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

function NavButton({
  onClick,
  disabled,
  loading,
  label,
  children,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-white px-2.5 text-sm text-content transition-colors hover:bg-surface-muted",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Pagination({ pagination, onPageChange, loading }) {
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const atStart = page <= 1;
  const atEnd = page >= totalPages || totalPages === 0;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-content-muted">
        Mostrando <span className="font-medium text-content">{from}</span>-
        <span className="font-medium text-content">{to}</span> de{" "}
        <span className="font-medium text-content">{total}</span> registros
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <NavButton
          label="Primera pagina"
          onClick={() => onPageChange(1)}
          disabled={atStart}
          loading={loading}
        >
          <ChevronFirst className="h-4 w-4" />
          <span className="hidden sm:inline">Inicio</span>
        </NavButton>
        <NavButton
          label="Retroceder 5 paginas"
          onClick={() => onPageChange(Math.max(1, page - 5))}
          disabled={atStart}
          loading={loading}
        >
          <ChevronsLeft className="h-4 w-4" />
          <span className="hidden md:inline">-5</span>
        </NavButton>
        <NavButton
          label="Pagina anterior"
          onClick={() => onPageChange(page - 1)}
          disabled={atStart}
          loading={loading}
          className="px-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </NavButton>
        <span className="px-2 text-sm text-content-muted sm:px-3">
          Pagina {page} de {Math.max(totalPages, 1)}
        </span>
        <NavButton
          label="Pagina siguiente"
          onClick={() => onPageChange(page + 1)}
          disabled={atEnd}
          loading={loading}
          className="px-3"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </NavButton>
        <NavButton
          label="Avanzar 5 paginas"
          onClick={() => onPageChange(Math.min(totalPages, page + 5))}
          disabled={atEnd}
          loading={loading}
        >
          <span className="hidden md:inline">+5</span>
          <ChevronsRight className="h-4 w-4" />
        </NavButton>
        <NavButton
          label="Ultima pagina"
          onClick={() => onPageChange(totalPages)}
          disabled={atEnd}
          loading={loading}
        >
          <span className="hidden sm:inline">Fin</span>
          <ChevronLast className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  );
}

export default Pagination;
