"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api/client";
import { userCreateSchema, userUpdateSchema } from "@/domains/users/schemas";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/forms/Field";
import { TextField, SelectField, CheckboxField } from "@/components/forms/fields";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";

export default function UserForm({ initial, onSubmit, saving }) {
  const isEdit = Boolean(initial);
  const [roles, setRoles] = useState([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? userUpdateSchema : userCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      email: initial?.email || "",
      password: "",
      roleIds: initial?.roles?.map((r) => r.id) || [],
      mustChangePassword: initial?.mustChangePassword ?? !isEdit,
      status: initial?.status || "ACTIVE",
    },
  });

  useEffect(() => {
    api
      .get("/api/roles?pageSize=100&status=ACTIVE&sort=name&order=asc")
      .then((res) => setRoles(res?.data || []))
      .catch(() => setRoles([]));
  }, []);

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} required />
      </div>

      <TextField
        label={isEdit ? "Nueva contrasena" : "Contrasena"}
        name="password"
        type="password"
        register={register}
        error={errors.password?.message}
        required={!isEdit}
        hint={isEdit ? "Dejar en blanco para no cambiarla." : "Minimo 8 caracteres, con letras y numeros."}
      />

      <Field label="Roles" error={errors.roleIds?.message}>
        <div className="grid gap-1.5 rounded-[var(--radius-sm)] border border-border p-3 sm:grid-cols-2">
          {roles.length === 0 && (
            <p className="text-sm text-content-muted">Cargando roles...</p>
          )}
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={role.id}
                className="h-4 w-4 rounded border-border text-brand-600"
                {...register("roleIds")}
              />
              <span className="text-content">{role.name}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Estatus" name="status" register={register} error={errors.status?.message}>
          {STATUS_FORM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SelectField>
      </div>

      <CheckboxField
        label="Solicitar cambio de contrasena al iniciar sesion"
        name="mustChangePassword"
        register={register}
      />

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}
