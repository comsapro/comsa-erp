"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api/client";
import { roleCreateSchema } from "@/domains/roles/schemas";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/forms/Field";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";

export default function RoleForm({ initial, onSubmit, saving }) {
  const [modules, setModules] = useState([]);
  const [selected, setSelected] = useState(
    () => new Set(initial?.permissionCodes || [])
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roleCreateSchema.omit({ permissionCodes: true })),
    defaultValues: {
      name: initial?.name || "",
      description: initial?.description || "",
      status: initial?.status || "ACTIVE",
    },
  });

  useEffect(() => {
    api
      .get("/api/permisos")
      .then((res) => setModules(res?.modules || []))
      .catch(() => setModules([]));
  }, []);

  const toggle = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const toggleModule = (mod, allSelected) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of mod.permissions) {
        if (allSelected) next.delete(p.code);
        else next.add(p.code);
      }
      return next;
    });
  };

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit({
      ...values,
      permissionCodes: [...selected],
    });
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  const total = useMemo(() => selected.size, [selected]);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <SelectField label="Estatus" name="status" register={register} error={errors.status?.message}>
          {STATUS_FORM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SelectField>
      </div>
      <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />

      <Field label={`Permisos (${total} seleccionados)`}>
        <div className="flex flex-col gap-3">
          {modules.length === 0 && (
            <p className="text-sm text-content-muted">Cargando permisos...</p>
          )}
          {modules.map((mod) => {
            const allSelected = mod.permissions.every((p) => selected.has(p.code));
            return (
              <div key={mod.module} className="rounded-[var(--radius-sm)] border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-content">{mod.label}</p>
                  <button
                    type="button"
                    onClick={() => toggleModule(mod, allSelected)}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    {allSelected ? "Quitar todos" : "Seleccionar todos"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {mod.permissions.map((p) => (
                    <label key={p.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(p.code)}
                        onChange={() => toggle(p.code)}
                        className="h-4 w-4 rounded border-border text-brand-600"
                      />
                      <span className="text-content">{p.actionLabel}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}
