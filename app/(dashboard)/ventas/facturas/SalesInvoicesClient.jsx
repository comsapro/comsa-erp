"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatDate, formatMoney } from "@/lib/utils/format";

export default function SalesInvoicesClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `/api/ventas/facturas${toQuery({
          pendingReception: pendingOnly ? "1" : undefined,
        })}`
      );
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las facturas");
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas de ventas"
        description="Registro de facturas que alimentan la meta del equipo."
        actions={
          <Button as={Link} href="/ventas/facturas/nuevo">
            <Plus className="h-4 w-4" />
            Nueva factura
          </Button>
        }
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={!pendingOnly ? "primary" : "secondary"}
          onClick={() => setPendingOnly(false)}
        >
          Todas
        </Button>
        <Button
          size="sm"
          variant={pendingOnly ? "primary" : "secondary"}
          onClick={() => setPendingOnly(true)}
        >
          Sin recepción del cliente
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-muted">
              No hay facturas registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2 font-medium">Factura</th>
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Monto (c/IVA)</th>
                    <th className="px-2 py-2 font-medium">Vendedor</th>
                    <th className="px-2 py-2 font-medium">PO cliente</th>
                    <th className="px-2 py-2 font-medium">Cotizaciones</th>
                    <th className="px-2 py-2 font-medium">Recepción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-medium">{r.invoiceNumber}</td>
                      <td className="px-2 py-2">{formatDate(r.invoiceDate)}</td>
                      <td className="px-2 py-2">{formatMoney(r.netAmount)}</td>
                      <td className="px-2 py-2">{r.seller?.name}</td>
                      <td className="px-2 py-2">{r.clientPoNumber}</td>
                      <td className="px-2 py-2">
                        {(r.quotes || [])
                          .map((q) => q.quote?.folio)
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td className="px-2 py-2">
                        {r.receivedByClient ? (
                          <Badge tone="success">
                            Sí · {formatDate(r.receptionDate)}
                          </Badge>
                        ) : (
                          <Badge tone="warning">No</Badge>
                        )}
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
