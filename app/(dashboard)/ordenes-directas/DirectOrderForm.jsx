"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  directOrderCreateSchema,
  directOrderItemUpsertSchema,
} from "@/domains/direct-orders/schemas";
import { ORDER_TYPES, ORDER_TYPE_LABELS } from "@/domains/direct-orders/constants";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import {
  ClientCatalogSelect,
  ContactCatalogSelect,
  IssuingCompanyCatalogSelect,
} from "@/components/forms/catalog-selects";
import { Alert } from "@/components/feedback/Alert";

function toDateInput(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function DirectOrderForm({
  initial,
  onSubmitHeader,
  onSaveItem,
  onDeleteItem,
  saving,
  mode = "create",
}) {
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState(initial?.client?.contacts || []);
  const [loadError, setLoadError] = useState(null);
  const [itemError, setItemError] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(directOrderCreateSchema),
    defaultValues: {
      orderType: initial?.orderType || "GENERAL",
      clientId: initial?.clientId || "",
      clientContactId: initial?.clientContactId || "",
      issuingCompanyId: initial?.issuingCompanyId || "",
      requestDate: toDateInput(initial?.requestDate) || todayInput(),
      validUntil: toDateInput(initial?.validUntil),
      requisition: initial?.requisition || "",
      observations: initial?.observations || "",
    },
  });

  const clientId = useWatch({ control, name: "clientId" });
  const clientContactId = useWatch({ control, name: "clientContactId" });
  const issuingCompanyId = useWatch({ control, name: "issuingCompanyId" });

  const itemForm = useForm({
    resolver: zodResolver(directOrderItemUpsertSchema),
    defaultValues: {
      description: "",
      quantity: 1,
      unit: "",
      observations: "",
      benefitPercentage: 30,
    },
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/api/clientes?pageSize=100&status=ACTIVE&sort=commercialName&order=asc"),
      api.get(
        "/api/empresas-emisoras?pageSize=100&status=ACTIVE&sort=commercialName&order=asc"
      ),
    ])
      .then(([clientsRes, companiesRes]) => {
        if (cancelled) return;
        setClients(clientsRes?.data || []);
        setCompanies(companiesRes?.data || []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!clientId) {
      setContacts([]);
      setValue("clientContactId", "");
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    api
      .get(`/api/clientes/${clientId}`)
      .then((detail) => {
        if (cancelled) return;
        setContacts(detail?.contacts || []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, setValue]);

  const submitHeader = handleSubmit(async (values) => {
    const result = await onSubmitHeader(values);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
    return result;
  });

  const submitItem = itemForm.handleSubmit(async (values) => {
    if (!onSaveItem) return;
    setItemError(null);
    setItemSaving(true);
    try {
      await onSaveItem(values);
      itemForm.reset({
        description: "",
        quantity: 1,
        unit: "",
        observations: "",
        benefitPercentage: 30,
      });
    } catch (err) {
      setItemError(err.message || "No se pudo guardar el item");
    } finally {
      setItemSaving(false);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {loadError && (
        <Alert variant="danger" title="Error">
          {loadError}
        </Alert>
      )}

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-content">
          Datos generales
        </h2>
        <form onSubmit={submitHeader} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo de orden"
              name="orderType"
              register={register}
              error={errors.orderType?.message}
              required
            >
              {ORDER_TYPES.filter((t) => t !== "DIRECT_ORDER_REFERENCE").map(
                (t) => (
                  <option key={t} value={t}>
                    {ORDER_TYPE_LABELS[t]}
                  </option>
                )
              )}
            </SelectField>
            <IssuingCompanyCatalogSelect
              value={issuingCompanyId || ""}
              onChange={(id) =>
                setValue("issuingCompanyId", id, { shouldValidate: true })
              }
              options={companies}
              onOptionsChange={setCompanies}
              error={errors.issuingCompanyId?.message}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ClientCatalogSelect
              value={clientId || ""}
              onChange={(id) => setValue("clientId", id, { shouldValidate: true })}
              options={clients}
              onOptionsChange={setClients}
              error={errors.clientId?.message}
              required
              remoteSearch
            />
            <ContactCatalogSelect
              value={clientContactId || ""}
              onChange={(id) => setValue("clientContactId", id)}
              options={contacts}
              onOptionsChange={setContacts}
              clientId={clientId}
              error={errors.clientContactId?.message}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Fecha de solicitud"
              name="requestDate"
              type="date"
              register={register}
              error={errors.requestDate?.message}
              required
            />
            <TextField
              label="Vigencia"
              name="validUntil"
              type="date"
              register={register}
              error={errors.validUntil?.message}
            />
            <TextField
              label="Requisicion"
              name="requisition"
              register={register}
              error={errors.requisition?.message}
            />
          </div>

          <TextareaField
            label="Observaciones"
            name="observations"
            register={register}
            error={errors.observations?.message}
          />

          <div className="flex justify-end gap-2">
            <Button type="submit" loading={saving}>
              {mode === "create" ? "Crear borrador" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Card>

      {mode === "edit" && onSaveItem && (
        <Card className="p-5">
          <h2 className="mb-1 text-base font-semibold text-content">Items simples</h2>
          <p className="mb-4 text-sm text-content-muted">
            Los procesos, materiales, extras e instalaciones se capturan en la
            cotizacion ligada, sin horas. Esta lista solo complementa ordenes
            anteriores.
          </p>

          {initial?.items?.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-content-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Descripcion</th>
                    <th className="px-3 py-2 font-medium">Cant.</th>
                    <th className="px-3 py-2 font-medium">Unidad</th>
                    <th className="px-3 py-2 font-medium">Beneficio %</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initial.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-content-muted">
                        {item.position}
                      </td>
                      <td className="px-3 py-2 text-content">{item.description}</td>
                      <td className="px-3 py-2">{Number(item.quantity)}</td>
                      <td className="px-3 py-2">{item.unit || "-"}</td>
                      <td className="px-3 py-2">
                        {Number(item.benefitPercentage)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {onDeleteItem && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => onDeleteItem(item.id)}
                            aria-label="Eliminar item"
                          >
                            <Trash2 className="h-4 w-4 text-danger-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {itemError && (
            <Alert variant="danger" title="Error" className="mb-3">
              {itemError}
            </Alert>
          )}

          <form onSubmit={submitItem} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <TextField
                  label="Descripcion"
                  name="description"
                  register={itemForm.register}
                  error={itemForm.formState.errors.description?.message}
                  required
                />
              </div>
              <TextField
                label="Cantidad"
                name="quantity"
                type="number"
                step="any"
                register={itemForm.register}
                error={itemForm.formState.errors.quantity?.message}
                required
              />
              <TextField
                label="Unidad"
                name="unit"
                register={itemForm.register}
                error={itemForm.formState.errors.unit?.message}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField
                label="Beneficio %"
                name="benefitPercentage"
                type="number"
                step="any"
                register={itemForm.register}
                error={itemForm.formState.errors.benefitPercentage?.message}
              />
              <div className="sm:col-span-3">
                <TextareaField
                  label="Observaciones del item"
                  name="observations"
                  register={itemForm.register}
                  error={itemForm.formState.errors.observations?.message}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={itemSaving}>
                <Plus className="h-4 w-4" /> Agregar item
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
