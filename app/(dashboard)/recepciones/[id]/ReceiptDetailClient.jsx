"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";

export default function ReceiptDetailClient({ id }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/api/recepciones/${id}`)
      .then(setRow)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="text-danger-700">{error}</p>;
  if (!row) return <p className="text-content-muted">Cargando...</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Recepcion ${row.folio}`}
        description={row.supplier?.name}
        actions={
          <Button as={Link} href="/recepciones" variant="secondary">
            Volver
          </Button>
        }
      />
      <Card className="space-y-3 p-5 text-sm">
        <p>
          OC:{" "}
          <Link
            href={`/ordenes-compra/${row.purchaseOrderId}`}
            className="text-brand-700 hover:underline"
          >
            {row.purchaseOrder?.folio}
          </Link>
        </p>
        <p>Almacen: {row.warehouse?.name}</p>
        <p>Fecha: {formatDate(row.receiptDate)}</p>
        <p>Recibido por: {row.receivedByUser?.name}</p>
        <table className="mt-2 w-full">
          <thead>
            <tr className="border-b text-left text-content-muted">
              <th className="py-2">Item</th>
              <th className="py-2">Pedido</th>
              <th className="py-2">Previo</th>
              <th className="py-2">Recibido</th>
              <th className="py-2">Costo</th>
            </tr>
          </thead>
          <tbody>
            {row.items?.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="py-2">
                  {it.item?.sku} — {it.item?.name}
                </td>
                <td className="py-2">{toNumber(it.orderedQuantity)}</td>
                <td className="py-2">
                  {toNumber(it.previouslyReceivedQuantity)}
                </td>
                <td className="py-2">{toNumber(it.receivedQuantity)}</td>
                <td className="py-2">{formatMoney(it.unitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
