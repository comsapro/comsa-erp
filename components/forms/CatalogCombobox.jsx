"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Field } from "@/components/forms/Field";
import { cn } from "@/lib/utils/cn";

/**
 * Combobox buscable con opcion "Agregar nueva".
 * options: [{ value, label, description? }]
 */
export function CatalogCombobox({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Buscar...",
  emptyLabel = "Sin resultados",
  required = false,
  error,
  hint,
  disabled = false,
  allowClear = true,
  clearLabel = "Sin seleccion",
  canCreate = false,
  createLabel = "Agregar nueva",
  onCreateRequest,
  className,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label || ""} ${o.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectOption = (opt) => {
    onChange?.(opt?.value ?? "");
    setOpen(false);
    setQuery("");
  };

  const handleCreate = () => {
    const name = query.trim();
    setOpen(false);
    onCreateRequest?.(name);
    setQuery("");
  };

  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <div className={cn("relative", className)} ref={rootRef}>
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={openList}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-[var(--radius-sm)] border bg-white px-3 text-left text-sm transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            error ? "border-danger-500" : "border-border",
            disabled && "cursor-not-allowed bg-surface-muted opacity-70"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selected ? "text-content" : "text-content-muted"
            )}
          >
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-content-muted" />
        </button>

        {open && (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-white shadow-[var(--shadow-pop)]">
            <div className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe para buscar..."
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered.length === 1) selectOption(filtered[0]);
                    else if (canCreate && query.trim()) handleCreate();
                  }
                }}
              />
            </div>

            <ul
              role="listbox"
              className="max-h-56 overflow-y-auto py-1"
            >
              {allowClear && (
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content-muted hover:bg-surface-muted"
                    onClick={() => selectOption({ value: "" })}
                  >
                    {clearLabel}
                  </button>
                </li>
              )}

              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-content-muted">{emptyLabel}</li>
              )}

              {filtered.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted",
                        active && "bg-brand-50 text-brand-700"
                      )}
                      onClick={() => selectOption(opt)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="block truncate text-xs text-content-muted">
                            {opt.description}
                          </span>
                        )}
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {canCreate && (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Plus className="h-4 w-4" />
                  {query.trim()
                    ? `${createLabel}: "${query.trim()}"`
                    : createLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

export default CatalogCombobox;
