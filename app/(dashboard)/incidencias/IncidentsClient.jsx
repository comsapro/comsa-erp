"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Siren } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import {
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_PRIORITY_TONES,
  INCIDENT_STATUS_TONES,
} from "@/domains/kpis/constants";
import { IncidentDetailModal } from "@/components/kpis/IncidentDetailModal";
import { cn } from "@/lib/utils/cn";

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-[var(--radius-sm)] border border-border bg-white p-0.5" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded-[6px] px-2.5 py-1 text-xs font-medium",
            value === k ? "bg-brand-600 text-white" : "text-content-muted hover:bg-surface-muted"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function IncidentsClient({ initialId }) {
  const router = useRouter();
  const [scope, setScope] = useState("mine");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(initialId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/incidencias${toQuery({ scope, status, q: search })}`);
      setRows(res?.data || []);
      setCanManage(Boolean(res?.canManage));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las incidencias");
    } finally {
      setLoading(false);
    }
  }, [scope, status, search]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  function openIncident(id) {
    setOpenId(id);
    router.replace(id ? `/incidencias?id=${id}` : "/incidencias", { scroll: false });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidencias"
        description="Trabajos detenidos y pendientes detectados en la junta. Da seguimiento hasta que queden resueltos."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Alcance"
          value={scope}
          onChange={setScope}
          options={[
            ["mine", "Mías"],
            ["assigned", "Asignadas a mí"],
            ...(canManage ? [["all", "Todas"]] : []),
          ]}
        />
        <Segmented
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            ["open", "Abiertas"],
            ["closed", "Resueltas / cerradas"],
            ["all", "Todas"],
          ]}
        />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Input className="h-9 w-56!" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Proyecto, cliente o razón…" />
          <Button size="sm" variant="secondary" type="submit" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Siren} title="Sin incidencias" description="No hay incidencias con los filtros seleccionados." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openIncident(r.id)}
                  className="flex w-full flex-wrap items-start gap-3 px-5 py-3 text-left hover:bg-surface-muted/60"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={INCIDENT_PRIORITY_TONES[r.priority]}>{INCIDENT_PRIORITY_LABELS[r.priority]}</Badge>
                      <Badge tone={INCIDENT_STATUS_TONES[r.status]}>{r.statusLabel}</Badge>
                      {r.blocking && r.status !== "RESOLVED" && r.status !== "CLOSED" && <Badge tone="danger">Detenido</Badge>}
                      <span className="font-medium text-content">{r.title}</span>
                    </div>
                    <p className="text-sm text-content-muted">
                      {r.project}
                      {r.quoteFolio ? ` · ${r.quoteFolio}` : ""} · {r.client}
                      {r.position != null ? ` · Partida ${r.position}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-content-muted">
                    <p>
                      Responsable: <span className="font-medium text-content">{r.assignedTo?.name || "—"}</span>
                    </p>
                    <p>{formatDateTime(r.createdAt)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <IncidentDetailModal incidentId={openId} onClose={() => openIncident(null)} onChanged={load} />
    </div>
  );
}
