"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";

export default function HistoryClient({ orderId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/calidad/historial/${orderId}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return null;

  const k = data.kpis || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Historial · ${data.order?.folio || orderId}`}
        description={`${data.order?.clientName || ""}${
          data.order?.quoteFolio ? ` · ${data.order.quoteFolio}` : ""
        }`}
        actions={
          <Button as={Link} href={`/calidad/${orderId}`} variant="secondary">
            Abrir Calidad
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Solicitadas", k.requested],
          ["Fabricadas", k.fabricated],
          ["Inspeccionadas", k.inspected],
          ["Liberadas", k.released],
          ["Rechazadas", k.rejected],
          ["Retrabajos formales", k.reworkOrders],
          ["Retrabajos simples", k.reworkSimples],
          ["Horas retrabajo", k.reworkHours],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-xs text-content-muted">{label}</p>
              <p className="text-2xl font-semibold">{value ?? 0}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">
            % rechazo: {((k.rejectRate || 0) * 100).toFixed(1)}%
          </h2>
        </CardHeader>
        <CardBody>
          <p className="mb-2 text-sm font-medium">Principales causas</p>
          {(k.topCauses || []).length === 0 ? (
            <p className="text-sm text-content-muted">Sin causas registradas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {k.topCauses.map((c) => (
                <li key={c.cause}>
                  {c.cause} — {c.count}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
