"use client";

import { ProductionItemQr } from "@/components/production/ProductionItemQr";
import { Card } from "@/components/ui/Card";

export function ProductionQrPanel({ orderId, items = [] }) {
  const active = items.filter((item) => item.status !== "CANCELLED");
  if (!active.length) return null;

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Codigos QR de partidas</h2>
        <p className="text-xs text-content-muted">
          Escanear con el celular para iniciar o terminar tiempos de produccion en la etapa
          pendiente.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {active.map((item) => (
          <ProductionItemQr key={item.id} orderId={orderId} item={item} size="md" />
        ))}
      </div>
    </Card>
  );
}
