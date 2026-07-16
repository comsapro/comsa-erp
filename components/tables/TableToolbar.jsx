"use client";

import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";

// Barra de herramientas de listado: busqueda, filtros y refrescar.
export function TableToolbar({
  q,
  onSearch,
  searchPlaceholder = "Buscar...",
  filters = [],
  onRefresh,
  loading,
  children,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label="Buscar"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="h-10 w-auto min-w-[150px]"
            aria-label={filter.label}
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ))}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-white text-content-muted transition-colors hover:bg-surface-muted"
            aria-label="Actualizar"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        )}

        {children}
      </div>
    </div>
  );
}

export default TableToolbar;
