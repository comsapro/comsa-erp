"use client";

import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import {
  ANNOTATION_TYPE_LABELS,
} from "@/domains/quality/drawing-constants";

function resultTone(row) {
  const result = row.measurement?.result || row.status;
  if (result === "PASS") return "success";
  if (result === "FAIL") return "danger";
  if (row.annotationType === "OBSERVATION") return "warning";
  return "neutral";
}

function resultLabel(row) {
  if (row.measurement?.result === "PASS") return "PASA";
  if (row.measurement?.result === "FAIL") return "NO PASA";
  if (row.status === "PASS") return "PASA";
  if (row.status === "FAIL") return "NO PASA";
  if (row.annotationType === "MEASUREMENT") return "MEDICION";
  return ANNOTATION_TYPE_LABELS[row.annotationType] || row.annotationType;
}

function measurementSummary(row) {
  const m = row.measurement;
  if (!m) return row.comment || row.title || "";
  return `${m.measuredValue} / ${m.nominalValue} ${m.unit || ""}`.trim();
}

export function AnnotationSidebar({
  annotations = [],
  selectedId,
  onSelect,
  onGoto,
}) {
  const byPage = new Map();
  for (const row of annotations) {
    const list = byPage.get(row.pageNumber) || [];
    list.push(row);
    byPage.set(row.pageNumber, list);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);

  if (!annotations.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-content-muted">
        Sin incisos en esta inspeccion.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {pages.map((pageNumber) => (
        <div key={pageNumber}>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Pagina {pageNumber}
          </p>
          <ul className="space-y-1">
            {byPage.get(pageNumber).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect?.(row);
                    onGoto?.(row);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 text-left text-sm transition-colors",
                    row.id === selectedId
                      ? "border-brand-300 bg-brand-50"
                      : "border-transparent hover:bg-surface-muted"
                  )}
                >
                  <span className="font-bold text-content">{row.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-content">
                      {row.title || measurementSummary(row) || ANNOTATION_TYPE_LABELS[row.annotationType]}
                    </span>
                    <span className="block truncate text-xs text-content-muted">
                      {measurementSummary(row)}
                    </span>
                  </span>
                  <Badge tone={resultTone(row)}>{resultLabel(row)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default AnnotationSidebar;
