"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteTemplateCreateSchema } from "@/domains/quote-templates/schemas";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { CostLineSections } from "@/components/quotes/CostLineSections";
import { useToast } from "@/components/feedback/ToastProvider";

function num(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function mapLines(initial) {
  return {
    manufacturing: (initial?.manufacturing || []).map((r, i) => ({
      manufacturingProcessId: r.manufacturingProcessId || null,
      processNameSnapshot: r.processNameSnapshot || "",
      unitSnapshot: r.unitSnapshot || "HOUR",
      quantity: num(r.quantity, 1),
      unitRate: num(r.unitRate, 0),
      observations: r.observations || "",
      sortOrder: r.sortOrder ?? i,
    })),
    materials: (initial?.materials || []).map((r) => ({
      itemId: r.itemId || null,
      supplierId: r.supplierId || null,
      descriptionSnapshot: r.descriptionSnapshot || "",
      dimensions: r.dimensions || "",
      presentation: r.presentation || "",
      unit: r.unit || "",
      quantity: num(r.quantity, 1),
      unitPrice: num(r.unitPrice, 0),
      observations: r.observations || "",
    })),
    extras: (initial?.extras || []).map((r) => ({
      description: r.description || "",
      quantity: num(r.quantity, 1),
      unit: r.unit || "",
      unitPrice: num(r.unitPrice, 0),
      supplierId: r.supplierId || null,
      observations: r.observations || "",
    })),
    installations: (initial?.installations || []).map((r) => ({
      installationConceptId: r.installationConceptId || null,
      conceptNameSnapshot: r.conceptNameSnapshot || "",
      unitSnapshot: r.unitSnapshot || "SERVICE",
      quantity: num(r.quantity, 1),
      unitPrice: num(r.unitPrice, 0),
      observations: r.observations || "",
    })),
  };
}

export default function TemplateForm({ initial, onSubmit, saving }) {
  const { toast } = useToast();
  const [processes, setProcesses] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quoteTemplateCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      category: initial?.category || "",
      description: initial?.description || "",
      defaultQuantity: num(initial?.defaultQuantity, 1),
      unit: initial?.unit || "",
      deliveryTimeMin: initial?.deliveryTimeMin ?? "",
      deliveryTimeMax: initial?.deliveryTimeMax ?? "",
      deliveryTimeUnit: initial?.deliveryTimeUnit || "days",
      deliveryDaysType: initial?.deliveryDaysType || "",
      observations: initial?.observations || "",
      benefitPercentage: num(initial?.benefitPercentage, 30),
      status: initial?.status || "ACTIVE",
      ...mapLines(initial),
    },
  });

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingCatalogs(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([
      api.get(`/api/procesos${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      api.get(`/api/instalaciones${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
    ])
      .then(([procRes, instRes]) => {
        if (cancelled) return;
        setProcesses(procRes?.data || []);
        setInstallations(instRes?.data || []);
      })
      .catch((error) => {
        if (cancelled) return;
        toast({
          variant: "error",
          title: "No se pudieron cargar catalogos",
          description: error.message,
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalogs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const submit = handleSubmit(async (values) => {
    const payload = {
      ...values,
      deliveryTimeMin:
        values.deliveryTimeMin === "" || values.deliveryTimeMin == null
          ? null
          : Number(values.deliveryTimeMin),
      deliveryTimeMax:
        values.deliveryTimeMax === "" || values.deliveryTimeMax == null
          ? null
          : Number(values.deliveryTimeMax),
      deliveryDaysType: values.deliveryDaysType || null,
      manufacturing: (values.manufacturing || []).map((r, i) => ({
        ...r,
        manufacturingProcessId: r.manufacturingProcessId || null,
        sortOrder: i,
      })),
      materials: (values.materials || []).map((r) => ({
        ...r,
        itemId: r.itemId || null,
        supplierId: r.supplierId || null,
      })),
      extras: (values.extras || []).map((r) => ({
        ...r,
        supplierId: r.supplierId || null,
      })),
      installations: (values.installations || []).map((r) => ({
        ...r,
        installationConceptId: r.installationConceptId || null,
      })),
    };

    const result = await onSubmit(payload);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nombre"
          name="name"
          register={register}
          error={errors.name?.message}
          required
        />
        <TextField
          label="Categoria"
          name="category"
          register={register}
          error={errors.category?.message}
        />
      </div>

      <TextareaField
        label="Descripcion"
        name="description"
        register={register}
        error={errors.description?.message}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Cantidad por defecto"
          name="defaultQuantity"
          type="number"
          step="0.001"
          min="0"
          register={register}
          error={errors.defaultQuantity?.message}
        />
        <TextField
          label="Unidad"
          name="unit"
          register={register}
          error={errors.unit?.message}
        />
        <TextField
          label="% Beneficio"
          name="benefitPercentage"
          type="number"
          step="0.01"
          min="0"
          register={register}
          error={errors.benefitPercentage?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <TextField
          label="Tiempo min"
          name="deliveryTimeMin"
          type="number"
          min="0"
          register={register}
          error={errors.deliveryTimeMin?.message}
        />
        <TextField
          label="Tiempo max"
          name="deliveryTimeMax"
          type="number"
          min="0"
          register={register}
          error={errors.deliveryTimeMax?.message}
        />
        <TextField
          label="Unidad de tiempo"
          name="deliveryTimeUnit"
          register={register}
          error={errors.deliveryTimeUnit?.message}
          placeholder="days"
        />
        <SelectField
          label="Tipo de dias"
          name="deliveryDaysType"
          register={register}
          error={errors.deliveryDaysType?.message}
        >
          <option value="">Sin especificar</option>
          <option value="BUSINESS">Habiles</option>
          <option value="CALENDAR">Naturales</option>
        </SelectField>
      </div>

      <TextareaField
        label="Observaciones"
        name="observations"
        register={register}
        error={errors.observations?.message}
      />

      <SelectField
        label="Estatus"
        name="status"
        register={register}
        error={errors.status?.message}
      >
        {STATUS_FORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>

      {loadingCatalogs ? (
        <p className="text-sm text-content-muted">Cargando catalogos...</p>
      ) : (
        <CostLineSections
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
          processes={processes}
          installations={installations}
          onProcessesChange={setProcesses}
          onInstallationsChange={setInstallations}
        />
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
