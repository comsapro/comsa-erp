"use client";

import { cn } from "@/lib/utils/cn";
import { hoursTone } from "@/domains/production/process-rules";

export function HoursBar({ quotedHours, expectedHours, realHours, compact = false }) {
  const quoted = Number(quotedHours) || 0;
  const expected = Number(expectedHours) || 0;
  const real = Number(realHours) || 0;
  const cap = Math.max(quoted, expected, real, 0.001);
  const tone = hoursTone({ expectedHours: expected, realHours: real });
  const toneClass = {
    success: "bg-success-600",
    warning: "bg-warning-600",
    danger: "bg-danger-600",
    neutral: "bg-brand-600",
  }[tone];

  return (
    <div className={cn("min-w-0", compact ? "w-28" : "w-full")}>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-200", toneClass)}
          style={{ width: `${Math.min(100, (real / cap) * 100)}%` }}
        />
      </div>
      <p className="mt-1 truncate text-[11px] text-content-muted">
        Cot {quoted} · Obj {expected} · Real {real}
      </p>
    </div>
  );
}
