"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const POLL_MS = 60_000;

const PRIORITY_DOT = {
  LOW: "bg-content-muted",
  MEDIUM: "bg-brand-500",
  HIGH: "bg-warning-500",
  CRITICAL: "bg-danger-500",
};

/** Campana con notificaciones internas del ERP (consulta periodica). */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState([]);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/notificaciones/resumen");
      setUnread(res?.unread || 0);
      setLatest(res?.latest || []);
    } catch {
      // Silencioso: la campana no debe romper el layout.
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openNotification(n) {
    setOpen(false);
    if (!n.readAt) {
      await api.post(`/api/notificaciones/${n.id}/leer`).catch(() => {});
      load();
    }
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    await api.post("/api/notificaciones/leer-todas").catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative rounded-[var(--radius-sm)] p-2 text-content-muted transition-colors hover:bg-surface-muted"
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-md)] border border-border bg-white shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-content">Notificaciones</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>
          {latest.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-content-muted">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {latest.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={cn(
                      "flex w-full gap-2.5 px-4 py-2.5 text-left hover:bg-surface-muted/60",
                      !n.readAt && "bg-brand-50/50"
                    )}
                  >
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : PRIORITY_DOT[n.priority])}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-sm", !n.readAt ? "font-semibold text-content" : "text-content")}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="line-clamp-2 block whitespace-pre-line text-xs text-content-muted">{n.body}</span>
                      )}
                      <span className="text-[11px] text-content-muted">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 border-t border-border text-center text-xs font-medium text-brand-700">
            <Link href="/notificaciones" onClick={() => setOpen(false)} className="px-4 py-2 hover:bg-surface-muted">
              Ver todas
            </Link>
            <Link
              href="/incidencias"
              onClick={() => setOpen(false)}
              className="border-l border-border px-4 py-2 hover:bg-surface-muted"
            >
              Mis incidencias
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
