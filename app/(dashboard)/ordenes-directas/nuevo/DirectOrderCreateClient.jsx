"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import DirectOrderForm from "../DirectOrderForm";

export default function DirectOrderCreateClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const onSubmitHeader = async (values) => {
    setSaving(true);
    try {
      const requestDate = values.requestDate || new Date().toISOString().slice(0, 10);
      const validUntil =
        values.validUntil ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const record = await api.post("/api/cotizaciones", {
        orderType: values.orderType || "URGENT",
        clientId: values.clientId,
        clientContactId: values.clientContactId || null,
        issuingCompanyId: values.issuingCompanyId,
        elaborationDate: requestDate,
        requestDate,
        validUntil,
        requisition: values.requisition || null,
        internalObservations: values.observations || null,
        currency: "MXN",
        advancePercentage: 0,
        settlementPercentage: 100,
        clientDesignProvided: false,
        priceAfterProduction: true,
      });
      toast({
        variant: "success",
        title: "Orden directa creada",
        description: `Folio ${record.folio}. Carga procesos, materiales, extras e instalaciones. Las horas se capturan al terminar produccion.`,
      });
      router.push(`/cotizaciones/${record.id}`);
      return { ok: true };
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo crear",
        description: error.message,
      });
      return { fieldErrors: error.fieldErrors };
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nueva orden directa"
        description="Captura cliente y fechas. En el detalle cargas procesos, materiales, extras e instalaciones, sin horas."
        actions={
          <Button as={Link} href="/ordenes-directas" variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />
      <DirectOrderForm mode="create" saving={saving} onSubmitHeader={onSubmitHeader} />
    </div>
  );
}
