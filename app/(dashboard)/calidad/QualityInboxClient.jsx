"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/format";
import { QUALITY_ITEM_STATUS_LABELS } from "@/domains/quality/constants";

export default function QualityInboxClient() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/calidad/pendientes${toQuery({ q: q || undefined })}`);
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandeja de Calidad"
        description="Ordenes con partidas pendientes de inspeccion."
        actions={
          <div className="flex gap-2">
            <Input
              className="w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar folio o cliente..."
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
              }}
            />
            <Button variant="secondary" onClick={load} loading={loading}>
              Buscar
            </Button>
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-content-muted">
              No hay partidas pendientes de Calidad.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2">OP</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Partida</th>
                    <th className="px-2 py-2">Descripcion</th>
                    <th className="px-2 py-2">Solic.</th>
                    <th className="px-2 py-2">Fabr.</th>
                    <th className="px-2 py-2">Insp.</th>
                    <th className="px-2 py-2">Lib.</th>
                    <th className="px-2 py-2">Compromiso</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">1a pieza</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={`${r.productionOrderId}-${r.productionItemId}`}>
                      <td className="px-2 py-2 font-medium">{r.folio}</td>
                      <td className="px-2 py-2">{r.clientName}</td>
                      <td className="px-2 py-2">{r.position}</td>
                      <td className="max-w-xs truncate px-2 py-2">{r.description}</td>
                      <td className="px-2 py-2">{r.requestedQty}</td>
                      <td className="px-2 py-2">{r.fabricatedQty}</td>
                      <td className="px-2 py-2">{r.inspectedQty}</td>
                      <td className="px-2 py-2">{r.releasedQty}</td>
                      <td className="px-2 py-2">{formatDate(r.commitmentDate) || "—"}</td>
                      <td className="px-2 py-2">
                        <Badge>
                          {QUALITY_ITEM_STATUS_LABELS[r.inspectionStatus] ||
                            r.inspectionStatus}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        {r.requiresFirstPiece
                          ? r.firstPieceReleased
                            ? "Liberada"
                            : "Pendiente"
                          : "N/A"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button as={Link} href={`/calidad/${r.productionOrderId}`} size="sm" variant="subtle">
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
