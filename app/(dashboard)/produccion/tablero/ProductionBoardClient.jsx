"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { Can } from "@/components/permissions/Can";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatDateTime } from "@/lib/utils/format";
import { PRODUCTION_ACTIVITY_LABELS } from "@/domains/production/constants";

const KPI = [
  ["pendingOrders", "Pendientes"],
  ["plannedOrders", "Planeadas"],
  ["inProgressOrders", "En proceso"],
  ["delayedOrders", "Atrasadas"],
  ["completedOrders", "Terminadas"],
  ["itemsInProgress", "Partidas en proceso"],
  ["delayedItems", "Partidas atrasadas"],
  ["urgentItems", "Urgentes"],
  ["openIncidents", "Incidencias abiertas"],
  ["quotedHours", "Horas cotizadas"],
  ["expectedHours", "Horas objetivo"],
  ["realHours", "Horas reales"],
];

export default function ProductionBoardClient() {
  const [data, setData] = useState(null);
  const [handicap, setHandicap] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/produccion/tablero").then(setData).catch(() => setData({ kpis: {} }));
    api
      .get("/api/produccion/config")
      .then((row) => setHandicap(String(row.handicapPercent ?? 0)))
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const kpis = data.kpis || {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tablero de produccion"
        description="Indicadores operativos, entregas e incidencias."
        actions={
          <Button as={Link} href="/produccion" variant="secondary" size="sm">
            Ver ordenes
          </Button>
        }
      />

      <Can permission="production.manage_handicap">
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-content-muted">
              Handicap general (%)
            </label>
            <Input
              type="number"
              min="0"
              max="90"
              step="0.1"
              className="w-32"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api.patch("/api/produccion/config", {
                  handicapPercent: Number(handicap),
                  applyToPending: true,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            Recalcular pendientes
          </Button>
        </Card>
      </Can>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI.map(([key, label]) => (
          <Card key={key} className="p-4">
            <p className="text-sm text-content-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{kpis[key] ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Proximas entregas
          </div>
          <ul className="divide-y divide-border">
            {(data.upcomingDeliveries || []).length === 0 && (
              <li className="px-4 py-6 text-sm text-content-muted">
                Sin compromisos en 14 dias.
              </li>
            )}
            {(data.upcomingDeliveries || []).map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <Link
                  className="font-medium text-brand-700 hover:underline"
                  href={`/produccion/${item.productionOrder.id}`}
                >
                  {item.productionOrder.folio}
                </Link>{" "}
                · {item.description}
                <p className="text-xs text-content-muted">
                  {item.productionOrder.client?.commercialName} · compromiso{" "}
                  {String(item.commitmentDate || "").slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Actividad reciente
          </div>
          <ul className="divide-y divide-border">
            {(data.recentActivity || []).length === 0 && (
              <li className="px-4 py-6 text-sm text-content-muted">Sin actividad.</li>
            )}
            {(data.recentActivity || []).map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p>
                  {PRODUCTION_ACTIVITY_LABELS[row.type] || row.type}
                  {row.productionOrder?.folio
                    ? ` · ${row.productionOrder.folio}`
                    : ""}
                </p>
                <p className="text-xs text-content-muted">
                  {row.createdByUser?.name || "Sistema"} · {formatDateTime(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
