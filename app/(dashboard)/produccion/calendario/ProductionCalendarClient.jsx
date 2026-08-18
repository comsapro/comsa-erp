"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonthCalendar } from "@/components/views/MonthCalendar";
import { PRODUCTION_STATUS_LABELS } from "@/domains/production/constants";

export default function ProductionCalendarClient() {
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState("month");

  useEffect(() => {
    api.get("/api/produccion/agenda").then(setRows).catch(() => setRows([]));
  }, []);

  const dated = useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((item) => ({
        ...item,
        calendarDate:
          item.commitmentDate || item.plannedEndAt || item.plannedStartAt,
      })),
    [rows]
  );

  const today = new Date().toISOString().slice(0, 10);
  const delayed = dated.filter(
    (r) =>
      r.calendarDate &&
      String(r.calendarDate).slice(0, 10) < today &&
      r.status !== "COMPLETED"
  );
  const urgent = dated.filter((r) => r.priority === "URGENT" && r.status !== "COMPLETED");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendario de produccion"
        description="Consulta de compromisos y fechas planeadas. Los cambios se hacen en Gantt o en la partida."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "month" ? "primary" : "secondary"}
              onClick={() => setMode("month")}
            >
              Mes
            </Button>
            <Button
              size="sm"
              variant={mode === "week" ? "primary" : "secondary"}
              onClick={() => setMode("week")}
            >
              Semana
            </Button>
            <Button as={Link} href="/produccion/gantt" size="sm" variant="subtle">
              Abrir Gantt
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <p className="font-semibold">Atrasadas</p>
          <p className="text-2xl">{delayed.length}</p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="font-semibold">Urgentes</p>
          <p className="text-2xl">{urgent.length}</p>
        </Card>
      </div>

      {mode === "month" ? (
        <MonthCalendar
          rows={dated}
          getDate={(r) => r.calendarDate}
          getHref={(r) => `/produccion/${r.productionOrder.id}`}
          getTitle={(r) => r.productionOrder.folio}
          getSubtitle={(r) =>
            `${r.description} · ${PRODUCTION_STATUS_LABELS[r.status] || r.status}`
          }
          emptyTitle="Sin partidas"
          emptyDescription="No hay partidas con fecha compromiso o planeada."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {dated
              .filter((r) => r.calendarDate)
              .sort((a, b) => String(a.calendarDate).localeCompare(String(b.calendarDate)))
              .slice(0, 40)
              .map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <Link
                    href={`/produccion/${r.productionOrder.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {r.productionOrder.folio}
                  </Link>{" "}
                  · {String(r.calendarDate).slice(0, 10)} · {r.description}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
