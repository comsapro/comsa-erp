"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Navegacion entre versiones de una misma familia de cotizacion.
 */
export function QuoteVersionsNav({
  currentId,
  versions = [],
  parentQuote = null,
}) {
  if (!versions?.length && !parentQuote) return null;

  const list = versions?.length
    ? versions
    : parentQuote
      ? [parentQuote]
      : [];

  if (list.length <= 1 && !parentQuote) {
    // Una sola version: mostrar indicador discreto
    return (
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
          <GitBranch className="h-3.5 w-3.5" />
          Versiones
        </p>
        <p className="text-sm text-content-muted">
          Esta es la unica version de la cotizacion.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
        <GitBranch className="h-3.5 w-3.5" />
        Versiones de esta cotizacion
        <span className="font-normal normal-case tracking-normal">
          ({list.length})
        </span>
      </p>

      <ul className="flex flex-col gap-2">
        {list.map((v) => {
          const isCurrent = v.id === currentId;
          const letter = v.version || String(v.folio || "").split("-").pop();
          return (
            <li key={v.id}>
              {isCurrent ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-brand-200 bg-brand-50 px-3 py-2"
                  )}
                  aria-current="page"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-800">
                      {v.folio}
                      <span className="ml-2 text-xs font-medium text-brand-600">
                        Version {letter} · actual
                      </span>
                    </p>
                    {v.elaborationDate && (
                      <p className="text-xs text-content-muted">
                        {formatDate(v.elaborationDate)}
                        {v.total != null
                          ? ` · ${formatMoney(v.total, v.currency || "MXN")}`
                          : ""}
                      </p>
                    )}
                  </div>
                  {v.status && (
                    <QuoteStatusBadge
                      status={v.status}
                      label={QUOTE_STATUS_LABELS[v.status] || v.status}
                    />
                  )}
                </div>
              ) : (
                <Link
                  href={`/cotizaciones/${v.id}`}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-white px-3 py-2 transition-colors",
                    "hover:border-brand-300 hover:bg-brand-50/40"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-700">
                      {v.folio}
                      <span className="ml-2 text-xs font-normal text-content-muted">
                        Version {letter}
                      </span>
                    </p>
                    {v.elaborationDate && (
                      <p className="text-xs text-content-muted">
                        {formatDate(v.elaborationDate)}
                        {v.total != null
                          ? ` · ${formatMoney(v.total, v.currency || "MXN")}`
                          : ""}
                      </p>
                    )}
                  </div>
                  {v.status && (
                    <QuoteStatusBadge
                      status={v.status}
                      label={QUOTE_STATUS_LABELS[v.status] || v.status}
                    />
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {parentQuote && !list.some((v) => v.id === parentQuote.id) && (
        <p className="mt-2 text-xs text-content-muted">
          Origen inmediato:{" "}
          <Link
            href={`/cotizaciones/${parentQuote.id}`}
            className="text-brand-700 hover:underline"
          >
            {parentQuote.folio}
          </Link>
        </p>
      )}
    </div>
  );
}

export default QuoteVersionsNav;
