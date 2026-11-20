"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, Presentation, RefreshCw, Settings2 } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Can } from "@/components/permissions/Can";
import { PeriodSelector, normalizePeriodParams, periodApiParams } from "@/components/kpis/PeriodSelector";
import { SummaryBlocks } from "@/components/kpis/SummaryBlocks";
import { Tabs } from "@/components/kpis/ui";
import { CommitmentsPanel } from "@/components/kpis/CommitmentsPanel";
import { SalesPanel } from "@/components/kpis/SalesPanel";
import { ReceptionPanel } from "@/components/kpis/ReceptionPanel";
import { CollectionPanel } from "@/components/kpis/CollectionPanel";
import { QualityPanel } from "@/components/kpis/QualityPanel";
import { KPI_SECTIONS } from "@/domains/kpis/constants";
import { periodQuery } from "@/domains/kpis/periods";

const TABS = [{ key: "resumen", label: "Resumen" }, ...KPI_SECTIONS];

export default function ManagementDashboardClient({ initialParams, initialTab = "resumen" }) {
  const router = useRouter();
  const [period, setPeriod] = useState(() => normalizePeriodParams(initialParams));
  const [tab, setTab] = useState(initialTab);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const apiParams = useMemo(() => periodApiParams(period), [period]);
  const qs = periodQuery(apiParams);

  useEffect(() => {
    const next = periodQuery({ ...apiParams, tab: tab === "resumen" ? undefined : tab });
    router.replace(`/dashboard-gerencial${next ? `?${next}` : ""}`, { scroll: false });
  }, [apiParams, tab, router]);

  const loadSummary = useCallback(async () => {
    setError("");
    setSummary(null);
    try {
      setSummary(await api.get(`/api/kpis/resumen${toQuery(apiParams)}`));
    } catch (err) {
      setError(err.message || "No se pudo cargar el resumen");
    }
  }, [apiParams]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadSummary();
  }, [loadSummary, refreshKey]);

  const exportHref = (format, section = tab === "resumen" ? "all" : tab) =>
    `/api/kpis/exportar?${periodQuery({ ...apiParams, format, section })}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard gerencial"
        description="Indicadores de la junta semanal: compromisos, ventas, facturas por recibir, cobranza y calidad."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} href={`/dashboard-gerencial/junta${qs ? `?${qs}` : ""}`} size="sm">
              <Presentation className="h-4 w-4" />
              Modo Junta
            </Button>
            <Can permission="kpis.export">
              <Button as="a" href={exportHref("xlsx")} size="sm" variant="secondary">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button as="a" href={exportHref("pdf")} size="sm" variant="secondary">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </Can>
            <Can permission="kpis.manage_catalogs">
              <Button as={Link} href="/dashboard-gerencial/catalogos" size="sm" variant="ghost" aria-label="Catálogos y parámetros">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Can>
          </div>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-xs text-content-muted">Comparado contra: {summary.previous.label}</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setRefreshKey((k) => k + 1)} aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <SummaryBlocks blocks={summary?.blocks} onOpen={setTab} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div key={`${tab}-${refreshKey}`}>
        {tab === "resumen" && (
          <div className="space-y-4">
            <CommitmentsPanel initialView="overdue" onChanged={loadSummary} />
            <Can permission="kpis.export">
              <Alert variant="info" title="Reporte de junta">
                Descarga en un solo documento los cinco indicadores del periodo:{" "}
                <a className="font-medium underline" href={exportHref("pdf", "all")}>
                  PDF
                </a>{" "}
                ·{" "}
                <a className="font-medium underline" href={exportHref("xlsx", "all")}>
                  Excel
                </a>
              </Alert>
            </Can>
          </div>
        )}
        {tab === "compromisos" && <CommitmentsPanel onChanged={loadSummary} />}
        {tab === "ventas" && <SalesPanel params={apiParams} />}
        {tab === "recepcion" && <ReceptionPanel params={apiParams} />}
        {tab === "cobranza" && <CollectionPanel params={apiParams} />}
        {tab === "calidad" && <QualityPanel params={apiParams} periodQuery={qs} />}
      </div>
    </div>
  );
}
