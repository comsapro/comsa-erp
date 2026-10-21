"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";
import { parseFolioVersion } from "@/domains/quotes/versions";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function versionLetter(row) {
  return String(
    row?.version || parseFolioVersion(row?.folio).letter || "A"
  ).toUpperCase();
}

function summaryOf(row) {
  if (!row) return null;
  return {
    id: row.id,
    folio: row.folio,
    version: row.version,
    status: row.status,
    elaborationDate: row.elaborationDate,
    total: row.total,
    currency: row.currency,
  };
}

/**
 * Tab siempre visible para cambiar de version dentro de la misma cotizacion.
 */
export function QuoteVersionsNav({
  currentId,
  currentQuote = null,
  versions = [],
  parentQuote = null,
  childRevisions = [],
}) {
  const byId = new Map();
  if (parentQuote?.id) byId.set(parentQuote.id, summaryOf(parentQuote));
  for (const row of childRevisions || []) {
    if (row?.id) byId.set(row.id, summaryOf(row));
  }
  for (const row of versions || []) {
    if (row?.id) byId.set(row.id, summaryOf(row));
  }
  if (currentQuote?.id) byId.set(currentQuote.id, summaryOf(currentQuote));

  const list = [...byId.values()].sort((a, b) =>
    versionLetter(a).localeCompare(versionLetter(b))
  );
  if (!list.length) return null;

  const current = list.find((row) => row.id === currentId) || list[0];

  return (
    <nav aria-label="Versiones de la cotizacion" className="mb-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        Versiones
      </p>
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {list.map((row) => {
          const isCurrent = row.id === currentId;
          const letter = versionLetter(row);
          const className = cn(
            "-mb-px inline-flex max-w-full flex-wrap items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            isCurrent
              ? "border-brand-600 text-brand-800"
              : "border-transparent text-content-muted hover:border-border hover:text-content"
          );
          const label = (
            <>
              <span>Version {letter}</span>
              <span className="font-normal">{row.folio}</span>
              {row.status && (
                <QuoteStatusBadge
                  status={row.status}
                  label={QUOTE_STATUS_LABELS[row.status] || row.status}
                />
              )}
            </>
          );
          if (isCurrent) {
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected="true"
                aria-current="page"
                className={className}
              >
                {label}
              </button>
            );
          }
          return (
            <Link
              key={row.id}
              href={`/cotizaciones/${row.id}`}
              role="tab"
              aria-selected="false"
              className={className}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-content-muted">
        {list.length === 1
          ? "Esta es la unica version de la cotizacion."
          : [
              `${list.length} versiones`,
              current?.elaborationDate
                ? formatDate(current.elaborationDate)
                : null,
              current?.total != null
                ? formatMoney(current.total, current.currency || "MXN")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
      </p>
    </nav>
  );
}

export default QuoteVersionsNav;
