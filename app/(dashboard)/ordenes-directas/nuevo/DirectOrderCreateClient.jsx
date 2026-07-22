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
      const record = await api.post("/api/ordenes-directas", values);
      toast({
        variant: "success",
        title: "Orden creada",
        description: `Folio ${record.folio}`,
      });
      router.push(`/ordenes-directas/${record.id}`);
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
        description="Captura el encabezado. Luego podras agregar items en el detalle."
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
