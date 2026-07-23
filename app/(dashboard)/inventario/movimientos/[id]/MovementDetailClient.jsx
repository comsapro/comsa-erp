"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";
import {
  MOVEMENT_TYPE_LABELS,
  REFERENCE_TYPE_LABELS,
} from "@/domains/inventory/constants";

export default function MovementDetailClient({ id }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/api/inventario/movimientos/${id}`)
      .then(setRow)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return <p className="text-danger-700">{error}</p>;
  }
  if (!row) {
    return <p className="text-content-muted">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Movimiento ${row.folio}`}
        description={MOVEMENT_TYPE_LABELS[row.movementType] || row.movementType}
        actions={
          <Button as={Link} href="/inventario/movimientos" variant="secondary">
            Volver
          </Button>
        }
      />
      <Card className="grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-content-muted">Fecha</p>
          <p>{formatDateTime(row.movementDate)}</p>
        </div>
        <div>
          <p className="text-xs text-content-muted">Almacen</p>
          <p>{row.warehouse?.name}</p>
        </div>
        <div>
          <p className="text-xs text-content-muted">Item</p>
          <p>
            {row.item?.sku} — {row.item?.name}
          </p>
        </div>
        <div>
          <p className="text-xs text-content-muted">Cantidad</p>
          <p>{toNumber(row.quantity)}</p>
        </div>
        {row.unitCost != null && (
          <div>
            <p className="text-xs text-content-muted">Costo unitario</p>
            <p>{toNumber(row.unitCost)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-content-muted">Referencia</p>
          <p>
            {row.referenceType
              ? REFERENCE_TYPE_LABELS[row.referenceType] || row.referenceType
              : "—"}
            {row.referenceId ? ` / ${row.referenceId}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-content-muted">Usuario</p>
          <p>{row.createdByUser?.name}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-content-muted">Motivo / Notas</p>
          <p>{row.reason || row.notes || "—"}</p>
        </div>
      </Card>
    </div>
  );
}
