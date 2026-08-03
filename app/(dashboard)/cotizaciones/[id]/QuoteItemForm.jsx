"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteItemUpsertSchema } from "@/domains/quotes/schemas";
import {
  DELIVERY_TIME_UNITS,
  DELIVERY_TIME_UNIT_LABELS,
  normalizeDeliveryTimeUnit,
} from "@/domains/quotes/constants";
import { calculateQuoteItemTotals, lineAmount } from "@/lib/quotes/calculations";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
} from "@/components/forms/fields";
import { CostLineSections } from "@/components/quotes/CostLineSections";
import { PartidaDetailView } from "@/components/quotes/PartidaDetailView";
import { PartidaAttachments } from "@/components/quotes/PartidaAttachments";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { useToast } from "@/components/feedback/ToastProvider";

function num(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function mapLines(initial) {
  return {
    manufacturing: (initial?.manufacturing || []).map((r, i) => ({
      manufacturingProcessId: r.manufacturingProcessId || "",
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
      unit: r.unit || "PZA",
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

export default function QuoteItemForm({
  initial,
  onSubmit,
  saving,
  currency = "MXN",
  quoteId,
  onSavedToLibrary,
}) {
  const { has } = usePermissions();
  const { toast } = useToast();
  const [processes, setProcesses] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [savingLibrary, setSavingLibrary] = useState(false);

  const canViewCost = has("quotes.view_cost");
  const canViewBenefit = has("quotes.view_benefit");
  const canApplyDiscount = has("quotes.apply_discount");

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quoteItemUpsertSchema),
    defaultValues: {
      id: initial?.id || null,
      templateId: initial?.templateId || null,
      itemId: initial?.itemId || null,
      description: initial?.description || "",
      quantity: num(initial?.quantity, 1),
      unit: initial?.unit || "",
      deliveryTimeMin: initial?.deliveryTimeMin ?? "",
      deliveryTimeMax: initial?.deliveryTimeMax ?? "",
      deliveryTimeUnit:
        normalizeDeliveryTimeUnit(initial?.deliveryTimeUnit) || "DAY",
      deliveryDaysType: initial?.deliveryDaysType || "",
      clientObservations: initial?.clientObservations || "",
      internalObservations: initial?.internalObservations || "",
      benefitPercentage: num(initial?.benefitPercentage, 30),
      discountPercentage: num(initial?.discountPercentage, 0),
      isUrgent: Boolean(initial?.isUrgent),
      warehouseId: initial?.warehouseId || null,
      ...mapLines(initial),
    },
  });

  const watched = useWatch({ control });

  const preview = useMemo(() => {
    const manufacturing = (watched?.manufacturing || []).map((r) => ({
      amount: lineAmount(r.quantity, r.unitRate),
    }));
    const materials = (watched?.materials || []).map((r) => ({
      amount: lineAmount(r.quantity, r.unitPrice),
    }));
    const extras = (watched?.extras || []).map((r) => ({
      amount: lineAmount(r.quantity, r.unitPrice),
    }));
    const installationsRows = (watched?.installations || []).map((r) => ({
      amount: lineAmount(r.quantity, r.unitPrice),
    }));
    return calculateQuoteItemTotals({
      manufacturing,
      materials,
      extras,
      installations: installationsRows,
      benefitPercentage: watched?.benefitPercentage,
      discountPercentage: watched?.discountPercentage,
    });
  }, [watched]);

  const previewItem = useMemo(() => {
    const totals = preview;
    return {
      description: watched?.description || "Nueva partida",
      quantity: watched?.quantity,
      unit: watched?.unit,
      isUrgent: watched?.isUrgent,
      deliveryTimeMin: watched?.deliveryTimeMin,
      deliveryTimeMax: watched?.deliveryTimeMax,
      deliveryTimeUnit: watched?.deliveryTimeUnit,
      deliveryDaysType: watched?.deliveryDaysType,
      clientObservations: watched?.clientObservations,
      internalObservations: watched?.internalObservations,
      benefitPercentage: watched?.benefitPercentage,
      discountPercentage: watched?.discountPercentage,
      discountAmount: totals.discountAmount,
      manufacturingTotal: totals.manufacturingTotal,
      materialsTotal: totals.materialsTotal,
      extrasTotal: totals.extrasTotal,
      installationsTotal: totals.installationTotal,
      costTotal: totals.costTotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      manufacturing: (watched?.manufacturing || []).map((r, i) => ({
        id: `mfg-${i}`,
        processNameSnapshot: r.processNameSnapshot,
        unitSnapshot: r.unitSnapshot,
        quantity: r.quantity,
        unitRate: r.unitRate,
        amount: lineAmount(r.quantity, r.unitRate),
      })),
      materials: (watched?.materials || []).map((r, i) => ({
        id: `mat-${i}`,
        descriptionSnapshot: r.descriptionSnapshot,
        dimensions: r.dimensions,
        presentation: r.presentation,
        unit: r.unit,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        amount: lineAmount(r.quantity, r.unitPrice),
      })),
      extras: (watched?.extras || []).map((r, i) => ({
        id: `ext-${i}`,
        description: r.description,
        unit: r.unit,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        amount: lineAmount(r.quantity, r.unitPrice),
      })),
      installations: (watched?.installations || []).map((r, i) => ({
        id: `inst-${i}`,
        conceptNameSnapshot: r.conceptNameSnapshot,
        unitSnapshot: r.unitSnapshot,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        amount: lineAmount(r.quantity, r.unitPrice),
      })),
    };
  }, [watched, preview]);

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
        if (!cancelled) {
          toast({
            variant: "error",
            title: "No se pudieron cargar catalogos",
            description: error.message,
          });
        }
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
      id: values.id || null,
      templateId: values.templateId || null,
      itemId: values.itemId || null,
      warehouseId: values.warehouseId || null,
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

    if (!canApplyDiscount) {
      payload.discountPercentage = 0;
    }

    const result = await onSubmit(payload);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-content">General</h3>
        <TextareaField
          label="Descripcion"
          name="description"
          register={register}
          error={errors.description?.message}
          required
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Cantidad"
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            register={register}
            error={errors.quantity?.message}
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
            label="Entrega min"
            name="deliveryTimeMin"
            type="number"
            min="0"
            register={register}
            error={errors.deliveryTimeMin?.message}
          />
          <TextField
            label="Entrega max"
            name="deliveryTimeMax"
            type="number"
            min="0"
            register={register}
            error={errors.deliveryTimeMax?.message}
          />
          <SelectField
            label="Unidad de entrega"
            name="deliveryTimeUnit"
            register={register}
            error={errors.deliveryTimeUnit?.message}
          >
            {DELIVERY_TIME_UNITS.map((u) => (
              <option key={u} value={u}>
                {DELIVERY_TIME_UNIT_LABELS[u]}
              </option>
            ))}
          </SelectField>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextareaField
            label="Observaciones al cliente"
            name="clientObservations"
            register={register}
            error={errors.clientObservations?.message}
          />
          <TextareaField
            label="Observaciones internas"
            name="internalObservations"
            register={register}
            error={errors.internalObservations?.message}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckboxField label="Urgente" name="isUrgent" register={register} />
          {canApplyDiscount && (
            <TextField
              label="% Descuento"
              name="discountPercentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              register={register}
              error={errors.discountPercentage?.message}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-content">
          Líneas de costo de la partida
        </h3>
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
      </section>

      <section className="rounded-[var(--radius-md)] border border-border p-4">
        <PartidaAttachments
          quoteId={quoteId}
          itemId={initial?.id}
          initialAttachments={initial?.attachments || []}
          canEdit={Boolean(initial?.id) && has("quotes.edit")}
        />
      </section>

      <section className="rounded-[var(--radius-md)] border border-border bg-surface-muted/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-content">
          Vista de la partida
        </h3>
        <PartidaDetailView
          item={previewItem}
          currency={currency}
          canViewCost={canViewCost}
          canViewBenefit={canViewBenefit}
          compact
        />
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {initial?.id && quoteId && has("quote_templates.create") && (
          <Button
            type="button"
            variant="secondary"
            loading={savingLibrary}
            onClick={async () => {
              setSavingLibrary(true);
              try {
                await api.post(
                  `/api/cotizaciones/${quoteId}/items/${initial.id}/guardar-biblioteca`
                );
                toast({
                  variant: "success",
                  title: "Partida guardada en biblioteca",
                });
                onSavedToLibrary?.();
              } catch (err) {
                toast({
                  variant: "error",
                  title: "No se pudo guardar en biblioteca",
                  description: err.message,
                });
              } finally {
                setSavingLibrary(false);
              }
            }}
          >
            Guardar en biblioteca
          </Button>
        )}
        <Button type="submit" loading={saving}>
          Guardar partida
        </Button>
      </div>
    </form>
  );
}
