"use client";

import Link from "next/link";
import { FileText, Clock3, Factory, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

const CARDS = [
  {
    key: "draft",
    label: "Borrador",
    icon: FileText,
    status: "DRAFT",
    tone: "text-content-muted bg-surface-muted",
  },
  {
    key: "pendingApproval",
    label: "En aprobación",
    icon: Clock3,
    status: "PENDING_APPROVAL",
    tone: "text-warning-700 bg-warning-50",
  },
  {
    key: "inProduction",
    label: "En producción",
    icon: Factory,
    status: "IN_PRODUCTION",
    tone: "text-brand-600 bg-brand-50",
  },
  {
    key: "fabricated",
    label: "Fabricadas",
    icon: CircleCheck,
    status: "IN_PRODUCTION",
    tone: "text-success-700 bg-success-50",
  },
];

const PERIODS = [
  { value: "general", label: "General" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

export function QuoteStatusCards({
  quotes,
  period,
  onPeriodChange,
  sellerId,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-content">Estado de cotizaciones</h2>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange?.(p.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-brand-600 text-white"
                  : "bg-surface-muted text-content-muted hover:bg-brand-50 hover:text-brand-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const href = `/cotizaciones?status=${card.status}${
            sellerId ? `&sellerId=${sellerId}` : ""
          }`;
          return (
            <Link key={card.key} href={href}>
              <Card className="p-4 transition-shadow hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-content-muted">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-content">
                      {quotes?.[card.key] ?? 0}
                    </p>
                  </div>
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${card.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default QuoteStatusCards;
