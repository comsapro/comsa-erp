"use client";

import { formatMoney } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SALES_GOAL_PERIOD_LABELS } from "@/domains/sales/constants";

export function GoalProgressCard({ goal }) {
  if (!goal) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-content">Meta de ventas</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-content-muted">
            Aún no hay una meta configurada para el periodo actual.
          </p>
        </CardBody>
      </Card>
    );
  }

  const sellers = (goal.sellers || []).map((s) => s.name).join(", ");
  const teams = (goal.teams || []).map((t) => t.name).join(", ");
  const assignees = [teams, sellers].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-content">Meta de ventas</h2>
            <p className="mt-0.5 text-sm text-content-muted">
              {SALES_GOAL_PERIOD_LABELS[goal.period] || goal.period} · {goal.periodKey}
              {assignees ? ` · ${assignees}` : ""}
            </p>
          </div>
          <p className="text-2xl font-semibold text-brand-700">{goal.percent}%</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-content-muted">Meta establecida</p>
            <p className="text-lg font-semibold text-content">{formatMoney(goal.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-content-muted">Venta acumulada</p>
            <p className="text-lg font-semibold text-success-700">
              {formatMoney(goal.soldAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-content-muted">Restante</p>
            <p className="text-lg font-semibold text-warning-700">
              {formatMoney(goal.remaining)}
            </p>
          </div>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={goal.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance de meta de ventas"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-200"
            style={{ width: `${Math.min(100, goal.percent)}%` }}
          />
        </div>
      </CardBody>
    </Card>
  );
}

export default GoalProgressCard;
