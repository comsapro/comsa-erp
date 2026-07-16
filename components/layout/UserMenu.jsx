"use client";

import { useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils/cn";

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

export function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 transition-colors hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials(user?.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-medium text-content">
            {user?.name}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-content-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-[var(--radius-md)] border border-border bg-white shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-content">
                {user?.name}
              </p>
              <p className="truncate text-xs text-content-muted">
                {user?.email}
              </p>
            </div>
          </div>
          {user?.roles?.length > 0 && (
            <div className="flex flex-wrap gap-1 px-4 py-2">
              {user.roles.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-content-muted"
                >
                  <UserIcon className="h-3 w-3" />
                  {r.name}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            disabled={isPending}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50",
              isPending && "opacity-60"
            )}
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? "Cerrando sesion..." : "Cerrar sesion"}
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
