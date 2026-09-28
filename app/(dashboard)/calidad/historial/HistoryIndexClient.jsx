"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";

export default function HistoryIndexClient() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial consolidado de Calidad"
        description="Consulta KPIs por orden de produccion."
      />
      <Card>
        <CardBody className="flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            placeholder="ID de orden de produccion"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <Button
            disabled={!orderId.trim()}
            onClick={() => router.push(`/calidad/historial/${orderId.trim()}`)}
          >
            Consultar
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
