"use client";

import { LayoutGrid, CalendarDays, Table2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MODES = [
  { id: "table", label: "Tabla", icon: Table2 },
  { id: "kanban", label: "Tablero", icon: LayoutGrid },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
];

export function ViewModeToggle({ value, onChange, className }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-border bg-white p-0.5",
        className
      )}
      role="group"
      aria-label="Modo de vista"
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-600 text-white"
                : "text-content-muted hover:bg-surface-muted hover:text-content"
            )}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewModeToggle;
