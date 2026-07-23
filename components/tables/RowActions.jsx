"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Menu de acciones por fila. Usa portal + fixed para no quedar clipado por overflow de tablas.
// `actions` = [{ label, icon, onClick, hidden, danger }]
export function RowActions({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (
        buttonRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function place() {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = Math.min(
        320,
        actions.filter((a) => !a.hidden).length * 40 + 8
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 12;
      setCoords({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.right,
        openUp,
      });
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, actions]);

  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  const menu =
    open &&
    coords &&
    mounted &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: coords.openUp ? undefined : coords.top,
          bottom: coords.openUp
            ? window.innerHeight - coords.top
            : undefined,
          left: coords.left,
          transform: "translateX(-100%)",
        }}
        className="z-[100] w-48 overflow-hidden rounded-[var(--radius-md)] border border-border bg-white py-1 shadow-[var(--shadow-pop)]"
      >
        {visible.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onClick?.();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted",
                action.danger ? "text-danger-700" : "text-content"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {action.label}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-content-muted transition-colors hover:bg-surface-muted"
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </div>
  );
}

export default RowActions;
