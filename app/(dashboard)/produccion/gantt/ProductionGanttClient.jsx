"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/feedback/Skeleton";
import { PRODUCTION_PRIORITY_TONES, PRODUCTION_STATUS_LABELS } from "@/domains/production/constants";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";

function toDay(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function ProductionGanttClient() {
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    api.get("/api/produccion/agenda").then(setRows).catch(() => setRows([]));
  }, []);

  const range = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const dates = list
      .flatMap((r) => [toDay(r.plannedStartAt), toDay(r.plannedEndAt), toDay(r.commitmentDate)])
      .filter(Boolean)
      .sort();
    const start = dates[0] || new Date().toISOString().slice(0, 10);
    const end = dates[dates.length - 1] || addDays(start, 14);
    const days = [];
    let cursor = start;
    while (cursor <= end && days.length < 60) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return { start, days };
  }, [rows]);

  if (!rows) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gantt de partidas"
        description="Planeacion por fechas. Arrastra el fin para reprogramar (supervisor)."
        actions={
          <Button as={Link} href="/produccion" variant="secondary" size="sm">
            Ordenes
          </Button>
        }
      />
      <Card className="overflow-auto">
        <table className="min-w-[900px] w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="sticky left-0 z-10 w-56 bg-surface-muted px-3 py-2 text-left">
                Partida
              </th>
              {range.days.map((d) => (
                <th key={d} className="px-1 py-2 font-normal text-content-muted">
                  {d.slice(8, 10)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const start =
                toDay(item.plannedStartAt) ||
                toDay(item.plannedEndAt) ||
                toDay(item.commitmentDate);
              const end =
                toDay(item.plannedEndAt) ||
                toDay(item.commitmentDate) ||
                start;
              return (
                <tr key={item.id} className="border-b border-border">
                  <td className="sticky left-0 bg-white px-3 py-2">
                    <Link
                      href={`/produccion/${item.productionOrder.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {item.productionOrder.folio}
                    </Link>
                    <p className="truncate text-content-muted">{item.description}</p>
                    <Badge tone={PRODUCTION_PRIORITY_TONES[item.priority] || "neutral"}>
                      {PRODUCTION_STATUS_LABELS[item.status]}
                    </Badge>
                  </td>
                  {range.days.map((d) => {
                    const active = start && end && d >= start && d <= end;
                    return (
                      <td key={d} className="px-0 py-2">
                        {active ? (
                          <Can
                            permission="production.manage_planning"
                            fallback={
                              <div className="mx-0.5 h-4 rounded-sm bg-brand-600" />
                            }
                          >
                            <button
                              type="button"
                              title="Mover un dia hacia adelante"
                              className="mx-0.5 h-4 w-full rounded-sm bg-brand-600 hover:bg-brand-700"
                              disabled={saving === item.id}
                              onClick={async () => {
                                if (!end) return;
                                setSaving(item.id);
                                try {
                                  await api.patch(
                                    `/api/produccion/${item.productionOrder.id}/items/${item.id}`,
                                    {
                                      plannedStartAt: start,
                                      plannedEndAt: addDays(end, 1),
                                      reason: "Reprogramacion Gantt",
                                    }
                                  );
                                  const next = await api.get("/api/produccion/agenda");
                                  setRows(next);
                                } finally {
                                  setSaving(null);
                                }
                              }}
                            />
                          </Can>
                        ) : (
                          <div className="h-4" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="px-4 py-8 text-sm text-content-muted">
            No hay partidas con fechas de planeacion o compromiso.
          </p>
        )}
      </Card>
    </div>
  );
}
