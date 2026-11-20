"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/feedback/Alert";
import { Can } from "@/components/permissions/Can";
import { PeriodSelector, normalizePeriodParams, periodApiParams } from "@/components/kpis/PeriodSelector";
import { SummaryBlocks } from "@/components/kpis/SummaryBlocks";
import { CommitmentsPanel } from "@/components/kpis/CommitmentsPanel";
import {
  addDaysKey,
  formatDayShort,
  isDayKey,
  isoWeek,
  periodQuery,
  todayKey,
  weekRange,
} from "@/domains/kpis/periods";

/**
 * Vista para la junta de los martes: cinco bloques grandes y la lista de
 * compromisos de la semana, desde donde se registran incidencias sin salir.
 */
export default function MeetingModeClient({ initialParams, initialWeek }) {
  const router = useRouter();
  const [period, setPeriod] = useState(() => normalizePeriodParams(initialParams));
  const [weekDate, setWeekDate] = useState(isDayKey(initialWeek) ? initialWeek : todayKey());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const apiParams = useMemo(() => periodApiParams(period), [period]);
  const week = weekRange(weekDate);
  const weekNumber = isoWeek(week.from).week;

  useEffect(() => {
    const qs = periodQuery({ ...apiParams, semana: week.from });
    router.replace(`/dashboard-gerencial/junta?${qs}`, { scroll: false });
  }, [apiParams, week.from, router]);

  const load = useCallback(async () => {
    setError("");
    try {
      setSummary(await api.get(`/api/kpis/resumen${toQuery({ ...apiParams, date: week.from })}`));
    } catch (err) {
      setError(err.message || "No se pudo cargar la junta");
    }
  }, [apiParams, week.from]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const openSection = (key) => {
    const qs = periodQuery({ ...apiParams, tab: key });
    router.push(`/dashboard-gerencial?${qs}`);
  };

  const reportHref = `/api/kpis/exportar?${periodQuery({ ...apiParams, format: "pdf", section: "all", date: week.from })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] bg-brand-950 px-5 py-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-200">COMSA — Junta semanal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Semana {weekNumber}</h1>
          <p className="text-sm text-brand-100">
            {formatDayShort(week.from)} – {formatDayShort(week.to)}
            {summary && ` · Indicadores: ${summary.period.label} (vs ${summary.previous.label})`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-white/10 p-1">
            <button
              type="button"
              className="rounded p-1.5 hover:bg-white/15"
              onClick={() => setWeekDate(addDaysKey(week.from, -7))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Input
              type="date"
              value={weekDate}
              onChange={(e) => e.target.value && setWeekDate(e.target.value)}
              className="h-8 w-36! border-white/20 bg-white/10 text-white"
              aria-label="Semana de la junta"
            />
            <button
              type="button"
              className="rounded p-1.5 hover:bg-white/15"
              onClick={() => setWeekDate(addDaysKey(week.from, 7))}
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Can permission="kpis.export">
            <Button as="a" href={reportHref} size="sm" variant="secondary">
              <Download className="h-4 w-4" />
              Descargar reporte de junta
            </Button>
          </Can>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/15"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            aria-label="Pantalla completa"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button as={Link} href="/dashboard-gerencial" size="sm" variant="ghost" className="text-white hover:bg-white/15">
            <ArrowLeft className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>

      <PeriodSelector value={period} onChange={setPeriod} />

      {error && <Alert variant="danger">{error}</Alert>}

      <SummaryBlocks blocks={summary?.blocks} onOpen={openSection} large />

      <CommitmentsPanel meeting initialView="overdue" date={weekDate} onChanged={load} />
    </div>
  );
}
