"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils/format";

export default function AlertsClient() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/api/calidad/alertas${toQuery({
          status: status || undefined,
          audience: audience || undefined,
        })}`
      );
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, audience]);

  useEffect(() => {
    load();
  }, [load]);

  async function setAlertStatus(id, next) {
    await api.patch(`/api/calidad/alertas/${id}`, { status: next });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas de Calidad"
        description="Eventos operativos para Produccion, Ventas y Gerencia."
        actions={
          <div className="flex gap-2">
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Todas las audiencias</option>
              <option value="PRODUCTION">Produccion</option>
              <option value="SALES">Ventas</option>
              <option value="MANAGEMENT">Gerencia</option>
              <option value="QUALITY">Calidad</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OPEN">Abiertas</option>
              <option value="ACKNOWLEDGED">Acuse</option>
              <option value="RESOLVED">Resueltas</option>
              <option value="">Todas</option>
            </Select>
          </div>
        }
      />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <CardBody>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-content-muted">Sin alertas.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((a) => (
                <li key={a.id} className="rounded border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-content-muted">{a.body}</p>
                      <p className="mt-1 text-xs text-content-muted">
                        {a.audience} · {a.eventType} · {formatDateTime(a.createdAt)}
                        {a.productionOrder?.folio
                          ? ` · ${a.productionOrder.folio}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{a.status}</Badge>
                      {a.productionOrderId && (
                        <Button
                          as={Link}
                          href={`/calidad/${a.productionOrderId}`}
                          size="sm"
                          variant="subtle"
                        >
                          Abrir
                        </Button>
                      )}
                      {a.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setAlertStatus(a.id, "ACKNOWLEDGED")}
                        >
                          Acusar
                        </Button>
                      )}
                      {a.status !== "RESOLVED" && (
                        <Button
                          size="sm"
                          onClick={() => setAlertStatus(a.id, "RESOLVED")}
                        >
                          Resolver
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
