"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ToastContext = createContext({ toast: () => {} });

let idCounter = 0;

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ variant = "info", title, description, duration = 4000 }) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, variant, title, description }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] border bg-white px-4 py-3 shadow-[var(--shadow-pop)]",
                t.variant === "success" && "border-success-500/30",
                t.variant === "error" && "border-danger-500/30",
                t.variant === "info" && "border-border"
              )}
              role="status"
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  t.variant === "success" && "text-success-500",
                  t.variant === "error" && "text-danger-500",
                  t.variant === "info" && "text-brand-600"
                )}
              />
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-sm font-semibold text-content">{t.title}</p>
                )}
                {t.description && (
                  <p className="text-sm text-content-muted">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-content-muted hover:text-content"
                aria-label="Cerrar notificacion"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export default ToastProvider;
