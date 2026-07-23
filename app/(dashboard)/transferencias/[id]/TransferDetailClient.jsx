"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api/client";
import { toNumber } from "@/lib/quotes/calculations";
import { TRANSFER_STATUS_LABELS } from "@/domains/transfers/constants";

export default function TransferDetailClient({ id }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/api/transferencias/${id}`)
      .then(setRow)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/transferencias/${id}/acciones/${action}`, {});
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) return <p className="text-content-muted">Cargando...</p>;
  if (!row) return <p className="text-danger-700">{error}</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Transferencia ${row.folio}`}
        description={`${row.sourceWarehouse?.name} → ${row.destinationWarehouse?.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} href="/transferencias" variant="secondary">
              Volver
            </Button>
            {row.status === "DRAFT" && (
              <Button loading={busy} onClick={() => runAction("submit")}>
                Enviar
              </Button>
            )}
            {row.status === "PENDING" && (
              <Button loading={busy} onClick={() => runAction("approve")}>
                Aprobar
              </Button>
            )}
            {row.status === "APPROVED" && (
              <Button loading={busy} onClick={() => runAction("complete")}>
                Completar
              </Button>
            )}
            {["DRAFT", "PENDING", "APPROVED"].includes(row.status) && (
              <Button
                variant="danger"
                loading={busy}
                onClick={() => runAction("cancel")}
              >
                Cancelar
              </Button>
            )}
          </div>
        }
      />
      {error && <p className="text-sm text-danger-700">{error}</p>}
      <Card className="p-5">
        <Badge className="mb-3">
          {TRANSFER_STATUS_LABELS[row.status] || row.status}
        </Badge>
        <p className="text-sm text-content-muted">{row.notes || "Sin notas"}</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-content-muted">
              <th className="py-2">Item</th>
              <th className="py-2">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {row.items?.map((it) => (
              <tr key={it.id} className="border-b border-border">
                <td className="py-2">
                  {it.item?.sku} — {it.item?.name}
                </td>
                <td className="py-2">{toNumber(it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
