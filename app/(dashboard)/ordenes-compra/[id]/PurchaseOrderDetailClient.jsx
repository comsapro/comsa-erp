"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { api, toQuery } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";
import { PO_STATUS_LABELS } from "@/domains/purchase-orders/constants";
import { remainingQuantity } from "@/domains/purchase-orders/calculations";

export default function PurchaseOrderDetailClient({ id }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [recvQty, setRecvQty] = useState({});

  const load = useCallback(() => {
    api
      .get(`/api/ordenes-compra/${id}`)
      .then(setRow)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    api
      .get(`/api/almacenes${toQuery({ status: "ACTIVE", pageSize: 100 })}`)
      .then((res) => setWarehouses(res?.data || []));
  }, [load]);

  async function runAction(action, body = {}) {
    setBusy(true);
    setError(null);
    try {
      let payload = body;
      if (action === "reject" || action === "cancel") {
        const reason = window.prompt("Motivo:");
        if (!reason) {
          setBusy(false);
          return;
        }
        payload = { reason };
      }
      await api.post(`/api/ordenes-compra/${id}/acciones/${action}`, payload);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReceive() {
    setBusy(true);
    setError(null);
    try {
      const items = (row.items || [])
        .map((it) => ({
          purchaseOrderItemId: it.id,
          receivedQuantity: Number(recvQty[it.id] || 0),
          unitCost: toNumber(it.unitPrice),
        }))
        .filter((it) => it.receivedQuantity > 0);
      await api.post("/api/recepciones", {
        purchaseOrderId: id,
        warehouseId,
        receiptDate: new Date().toISOString().slice(0, 10),
        items,
      });
      setReceiveOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) return <p className="text-content-muted">Cargando...</p>;
  if (!row) return <p className="text-danger-700">{error}</p>;

  const canReceive = ["APPROVED", "PARTIALLY_RECEIVED"].includes(row.status);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`OC ${row.folio}`}
        description={row.supplier?.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} href="/ordenes-compra" variant="secondary">
              Volver
            </Button>
            <Can permission="purchase_orders.print">
              <Button
                as={Link}
                href={`/api/ordenes-compra/${id}/pdf`}
                variant="secondary"
                target="_blank"
              >
                PDF
              </Button>
            </Can>
            {row.status === "DRAFT" && (
              <Can permission="purchase_orders.submit">
                <Button loading={busy} onClick={() => runAction("submit")}>
                  Enviar
                </Button>
              </Can>
            )}
            {row.status === "PENDING_APPROVAL" && (
              <>
                <Can permission="purchase_orders.approve">
                  <Button loading={busy} onClick={() => runAction("approve")}>
                    Aprobar
                  </Button>
                </Can>
                <Can permission="purchase_orders.reject">
                  <Button
                    variant="danger"
                    loading={busy}
                    onClick={() => runAction("reject")}
                  >
                    Rechazar
                  </Button>
                </Can>
              </>
            )}
            {canReceive && (
              <Can permission="purchase_orders.receive">
                <Button
                  variant="secondary"
                  onClick={() => setReceiveOpen(true)}
                >
                  Recibir
                </Button>
              </Can>
            )}
            {["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"].includes(
              row.status
            ) && (
              <Can permission="purchase_orders.cancel">
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => runAction("cancel")}
                >
                  Cancelar
                </Button>
              </Can>
            )}
          </div>
        }
      />
      {error && <p className="text-sm text-danger-700">{error}</p>}
      <Card className="space-y-3 p-5">
        <Badge>{PO_STATUS_LABELS[row.status] || row.status}</Badge>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-content-muted">Solicitud</p>
            <p>{formatDate(row.requestDate)}</p>
          </div>
          <div>
            <p className="text-content-muted">Produccion</p>
            <p>
              {row.productionOrder ? (
                <Link
                  href={`/produccion/${row.productionOrder.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {row.productionOrder.folio}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-content-muted">Cotizacion</p>
            <p>{row.quote?.folio || "—"}</p>
          </div>
          <div>
            <p className="text-content-muted">Subtotal</p>
            <p>{formatMoney(row.subtotal)}</p>
          </div>
          <div>
            <p className="text-content-muted">IVA</p>
            <p>{formatMoney(row.tax)}</p>
          </div>
          <div>
            <p className="text-content-muted">Total</p>
            <p className="font-medium">{formatMoney(row.total)}</p>
          </div>
        </div>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-content-muted">
              <th className="py-2">Item</th>
              <th className="py-2">Cant.</th>
              <th className="py-2">Recibido</th>
              <th className="py-2">Pendiente</th>
              <th className="py-2">Precio</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {row.items?.map((it) => (
              <tr key={it.id} className="border-b border-border">
                <td className="py-2">{it.descriptionSnapshot}</td>
                <td className="py-2">{toNumber(it.quantity)}</td>
                <td className="py-2">{toNumber(it.receivedQuantity)}</td>
                <td className="py-2">
                  {remainingQuantity(it.quantity, it.receivedQuantity)}
                </td>
                <td className="py-2">{formatMoney(it.unitPrice)}</td>
                <td className="py-2">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {receiveOpen && (
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Recibir mercancia</h3>
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Almacen destino</span>
            <select
              className="w-full max-w-md rounded-md border border-border px-3 py-2"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
          {row.items?.map((it) => {
            const rem = remainingQuantity(it.quantity, it.receivedQuantity);
            if (rem <= 0) return null;
            return (
              <label key={it.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{it.descriptionSnapshot}</span>
                <span className="text-content-muted">Pend. {rem}</span>
                <input
                  type="number"
                  min="0"
                  max={rem}
                  step="0.001"
                  className="w-28 rounded-md border border-border px-2 py-1"
                  value={recvQty[it.id] ?? ""}
                  onChange={(e) =>
                    setRecvQty((prev) => ({
                      ...prev,
                      [it.id]: e.target.value,
                    }))
                  }
                />
              </label>
            );
          })}
          <div className="flex gap-2">
            <Button
              loading={busy}
              disabled={!warehouseId}
              onClick={submitReceive}
            >
              Confirmar recepcion
            </Button>
            <Button variant="secondary" onClick={() => setReceiveOpen(false)}>
              Cerrar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
