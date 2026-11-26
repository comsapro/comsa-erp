"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Tabs, SimpleTable } from "@/components/kpis/ui";
import { CommitmentFormModal } from "@/components/commitments/CommitmentFormModal";
import { formatDate } from "@/lib/utils/format";
import {
  COMMITMENT_STATUS_LABELS,
  COMMITMENT_STATUS_TONES,
} from "@/domains/commitments/constants";

const SCOPES = [
  { key: "pending", label: "Mis pendientes" },
  { key: "mine", label: "Todos los míos" },
  { key: "review", label: "Por aprobar" },
  { key: "created", label: "Creados por mí" },
];

export function CommitmentStatusBadge({ row }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={COMMITMENT_STATUS_TONES[row.status] || "neutral"}>
        {COMMITMENT_STATUS_LABELS[row.status] || row.status}
      </Badge>
      {row.overdue && <Badge tone="danger">Vencido</Badge>}
    </span>
  );
}

export default function CommitmentsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [scope, setScope] = useState("pending");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get(`/api/compromisos${toQuery({ scope })}`));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los compromisos");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const scopes = data?.canViewAll ? [...SCOPES, { key: "all", label: "Todos" }] : SCOPES;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compromisos"
        description="Compromisos con involucrados, fecha de inicio y de entrega. Cada involucrado marca su parte; quien lo creó lo aprueba para cerrarlo."
        actions={
          <div className="flex gap-2">
            <Button as={Link} href="/produccion/calendario" size="sm" variant="subtle">
              <CalendarDays className="h-4 w-4" />
              Calendario
            </Button>
            {data?.canCreate && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Nuevo compromiso
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="px-5 pt-3">
          <Tabs tabs={scopes} value={scope} onChange={setScope} />
        </div>
        <div className="p-3 sm:p-5">
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SimpleTable
              rows={data?.data || []}
              empty="Sin compromisos en esta vista."
              columns={[
                {
                  key: "title",
                  header: "Compromiso",
                  className: "min-w-[16rem]",
                  render: (r) => (
                    <Link href={`/compromisos/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.title}
                    </Link>
                  ),
                },
                {
                  key: "people",
                  header: "Involucrados",
                  render: (r) => (
                    <span className="text-sm">
                      {r.participants.map((p) => p.user?.name).join(", ")}
                      <span className="block text-xs text-content-muted">
                        {r.doneCount}/{r.participants.length} terminaron
                      </span>
                    </span>
                  ),
                },
                { key: "start", header: "Inicio", render: (r) => formatDate(r.startDate) },
                {
                  key: "due",
                  header: "Entrega",
                  render: (r) => <span className={r.overdue ? "font-medium text-danger-700" : ""}>{formatDate(r.dueDate)}</span>,
                },
                { key: "creator", header: "Creó", render: (r) => r.createdByUser?.name },
                { key: "status", header: "Estatus", render: (r) => <CommitmentStatusBadge row={r} /> },
              ]}
            />
          )}
        </div>
      </Card>

      <CommitmentFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(saved) => {
          setCreating(false);
          toast({ variant: "success", title: "Compromiso creado" });
          router.push(`/compromisos/${saved.id}`);
        }}
      />
    </div>
  );
}
