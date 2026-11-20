"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatMoney } from "@/lib/utils/format";
import { DETECTION_STAGE_SHORT } from "@/domains/kpis/constants";
import { formatDayShort } from "@/domains/kpis/periods";
import { ChartCard, DeltaBadge, HBarChart, SimpleTable, Stat, compactMoney } from "./ui";
import { usePanelData } from "./usePanelData";

function DistributionChart({ title, description, rows, measure }) {
  const mapped = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: measure === "cost" ? r.amount : r.count,
    display: measure === "cost" ? compactMoney(r.amount) : `${r.count} · ${r.pct}%`,
    detail: `${r.count} error(es) · ${r.pct}% · ${formatMoney(r.amount)}`,
  }));
  return (
    <ChartCard
      title={title}
      description={description}
      table={
        <SimpleTable
          dense
          rowKey={(r) => r.key}
          columns={[
            { key: "label", header: title.replace("Errores por ", "") },
            { key: "count", header: "Errores", align: "right" },
            { key: "pct", header: "%", align: "right", render: (r) => `${r.pct}%` },
            { key: "amount", header: "Costo", align: "right", render: (r) => formatMoney(r.amount) },
          ]}
          rows={rows}
        />
      }
    >
      <HBarChart rows={mapped.slice(0, 10)} empty="Sin errores en el periodo." />
    </ChartCard>
  );
}

/** KPI 5 — Calidad y errores de Produccion. */
export function QualityPanel({ params, periodQuery }) {
  const { data, loading, error } = usePanelData("/api/kpis/calidad", params);
  const [measure, setMeasure] = useState("count");

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (loading && !data) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Errores" value={data.totalErrors}>
            <DeltaBadge delta={data.compare.errors} goodWhen="down" />
          </Stat>
          <Stat label="Internos" value={data.internalErrors} hint={`Producción ${data.detectedByProduction} · Calidad ${data.detectedByQuality}`} />
          <Stat label="Escapes al cliente" value={data.escapes} tone={data.escapes ? "danger" : "default"}>
            <DeltaBadge delta={data.compare.escapes} goodWhen="down" />
          </Stat>
          <Stat label="Retrabajos" value={data.reworkCount}>
            <DeltaBadge delta={data.compare.reworks} goodWhen="down" />
          </Stat>
          <Stat label="Horas de retrabajo" value={data.reworkHours}>
            <DeltaBadge delta={data.compare.reworkHours} goodWhen="down" />
          </Stat>
          <Stat label="Costo de errores" value={formatMoney(data.totalCost)}>
            <DeltaBadge delta={data.compare.cost} format="money" goodWhen="down" />
          </Stat>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
          <p>
            Mano de obra {formatMoney(data.costBreakdown.labor)} · Materiales {formatMoney(data.costBreakdown.material)} · Otros{" "}
            {formatMoney(data.costBreakdown.other)} · Tarifa hora {formatMoney(data.laborHourRate)}
            {data.qualityEffectiveness != null && ` · Detección interna ${data.qualityEffectiveness}%`}
          </p>
          <div className="flex items-center gap-2">
            {data.unclassified > 0 && (
              <Badge tone="warning">{data.unclassified} error(es) sin clasificar</Badge>
            )}
            <Button as={Link} href={`/calidad/errores${periodQuery ? `?${periodQuery}` : ""}`} size="sm" variant="secondary">
              <ClipboardList className="h-4 w-4" />
              Registrar / clasificar errores
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <div className="inline-flex rounded-[var(--radius-sm)] border border-border bg-white p-0.5" role="group" aria-label="Medida">
          {[
            ["count", "Número de errores"],
            ["cost", "Costo"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={measure === k}
              onClick={() => setMeasure(k)}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${measure === k ? "bg-brand-600 text-white" : "text-content-muted hover:bg-surface-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionChart title="Errores por área" description="CNC, Torno, Fresadora, Soldadura, Ventas, Cliente…" rows={data.byArea} measure={measure} />
        <DistributionChart title="Errores por causa" description="Operador, instrucción, máquina, material…" rows={data.byCause} measure={measure} />
        <DistributionChart title="Errores por operador" rows={data.byOperator} measure={measure} />
      </div>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-content">Errores del periodo</h3>
          <p className="text-xs text-content-muted">Ordenados por costo · relacionados con proyecto, cotización y partida</p>
        </div>
        <div className="p-3 sm:p-5">
          <SimpleTable
            dense
            columns={[
              { key: "detectedAt", header: "Fecha", render: (r) => formatDayShort(r.detectedAt) },
              {
                key: "project",
                header: "Proyecto",
                render: (r) => (
                  <Link href={`/dashboard-gerencial/proyecto/${r.productionOrderId}`} className="text-brand-700 hover:underline">
                    {r.project}
                  </Link>
                ),
              },
              { key: "quoteFolio", header: "Cotización", render: (r) => r.quoteFolio || "—" },
              { key: "position", header: "Part.", align: "right", render: (r) => r.position ?? "—" },
              {
                key: "stage",
                header: "Detección",
                render: (r) => (
                  <Badge tone={r.detectionStage === "CLIENT" ? "danger" : r.detectionStage === "QUALITY" ? "brand" : "neutral"}>
                    {DETECTION_STAGE_SHORT[r.detectionStage]}
                  </Badge>
                ),
              },
              { key: "area", header: "Área", render: (r) => r.areaLabel || <span className="text-warning-700">Sin clasificar</span> },
              { key: "cause", header: "Causa", render: (r) => r.causeLabel || <span className="text-warning-700">Sin clasificar</span> },
              { key: "operatorLabel", header: "Operador" },
              { key: "description", header: "Descripción", className: "min-w-[14rem]", render: (r) => <span className="line-clamp-2">{r.description}</span> },
              { key: "hours", header: "Horas", align: "right", render: (r) => r.cost.hours },
              { key: "cost", header: "Costo", align: "right", render: (r) => formatMoney(r.cost.total) },
            ]}
            rows={data.errors}
            empty="Sin errores registrados en el periodo."
          />
        </div>
      </Card>
    </div>
  );
}

export default QualityPanel;
