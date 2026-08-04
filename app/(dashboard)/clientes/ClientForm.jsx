"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Star } from "lucide-react";
import { clientCreateSchema } from "@/domains/clients/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/forms/Field";
import {
  TextField,
  SelectField,
  CheckboxField,
} from "@/components/forms/fields";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";

function parseCommercialTermsValue(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

export default function ClientForm({ initial, onSubmit, saving }) {
  const initialTermsValue = parseCommercialTermsValue(initial?.commercialTerms);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      commercialName: initial?.commercialName || "",
      legalName: initial?.legalName || "",
      rfc: initial?.rfc || "",
      address: initial?.address || "",
      phone: initial?.phone || "",
      hasCommercialTerms: initialTermsValue != null,
      commercialTermsValue:
        initialTermsValue != null ? initialTermsValue : "",
      status: initial?.status || "ACTIVE",
      contacts:
        initial?.contacts?.map((c) => ({
          name: c.name || "",
          position: c.position || "",
          phone: c.phone || "",
          email: c.email || "",
          isPrimary: Boolean(c.isPrimary),
        })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });
  const contacts = useWatch({ control, name: "contacts" });
  const hasCommercialTerms = useWatch({ control, name: "hasCommercialTerms" });

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  const setPrimary = (index) => {
    contacts.forEach((_, i) => setValue(`contacts.${i}.isPrimary`, i === index));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nombre comercial"
          name="commercialName"
          register={register}
          error={errors.commercialName?.message}
          required
        />
        <TextField
          label="Razon social"
          name="legalName"
          register={register}
          error={errors.legalName?.message}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="RFC"
          name="rfc"
          register={register}
          error={errors.rfc?.message}
        />
        <TextField
          label="Telefono"
          name="phone"
          register={register}
          error={errors.phone?.message}
        />
      </div>
      <TextField
        label="Direccion"
        name="address"
        register={register}
        error={errors.address?.message}
      />

      <div className="rounded-[var(--radius-md)] border border-border p-4">
        <CheckboxField
          label="Condiciones comerciales"
          name="hasCommercialTerms"
          register={register}
          hint="Activa para capturar el valor numerico (p. ej. dias de credito)."
        />
        <div className="mt-3 max-w-xs">
          <TextField
            label="Valor"
            name="commercialTermsValue"
            type="number"
            min="0"
            step="1"
            register={register}
            error={errors.commercialTermsValue?.message}
            disabled={!hasCommercialTerms}
          />
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-content">Contactos</p>
            <p className="text-xs text-content-muted">
              Agrega uno o mas contactos. Marca uno como principal.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              append({
                name: "",
                position: "",
                phone: "",
                email: "",
                isPrimary: fields.length === 0,
              })
            }
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="py-2 text-sm text-content-muted">
            Sin contactos adicionales.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-[var(--radius-sm)] bg-surface-muted/60 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nombre"
                  error={errors.contacts?.[index]?.name?.message}
                >
                  <Input
                    invalid={!!errors.contacts?.[index]?.name}
                    {...register(`contacts.${index}.name`)}
                  />
                </Field>
                <Field label="Puesto">
                  <Input {...register(`contacts.${index}.position`)} />
                </Field>
                <Field label="Telefono">
                  <Input {...register(`contacts.${index}.phone`)} />
                </Field>
                <Field
                  label="Correo"
                  error={errors.contacts?.[index]?.email?.message}
                >
                  <Input
                    type="email"
                    invalid={!!errors.contacts?.[index]?.email}
                    {...register(`contacts.${index}.email`)}
                  />
                </Field>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPrimary(index)}
                  className={
                    contacts?.[index]?.isPrimary
                      ? "inline-flex items-center gap-1 text-sm font-medium text-warning-700"
                      : "inline-flex items-center gap-1 text-sm text-content-muted hover:text-content"
                  }
                >
                  <Star
                    className="h-4 w-4"
                    fill={contacts?.[index]?.isPrimary ? "currentColor" : "none"}
                  />
                  {contacts?.[index]?.isPrimary
                    ? "Principal"
                    : "Marcar principal"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex items-center gap-1 text-sm text-danger-700 hover:underline"
                >
                  <Trash2 className="h-4 w-4" /> Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
