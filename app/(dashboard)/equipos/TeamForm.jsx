"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toQuery } from "@/lib/api/client";
import { teamCreateSchema } from "@/domains/teams/schemas";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/forms/Field";
import { TextField, SelectField } from "@/components/forms/fields";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { Badge } from "@/components/ui/Badge";

export default function TeamForm({ initial, onSubmit, saving }) {
  const isEdit = Boolean(initial);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(
    initial?.memberIds || initial?.members?.map((u) => u.id) || []
  );
  const [selectedRoles, setSelectedRoles] = useState(
    initial?.roleIds || initial?.roles?.map((r) => r.id) || []
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(teamCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      description: initial?.description || "",
      status: initial?.status || "ACTIVE",
      userIds: initial?.memberIds || initial?.members?.map((u) => u.id) || [],
      roleIds: initial?.roleIds || initial?.roles?.map((r) => r.id) || [],
    },
  });

  useEffect(() => {
    Promise.all([
      api.get(
        `/api/usuarios/activos${toQuery({ pageSize: 200, sort: "name", order: "asc" })}`
      ),
      api.get(
        `/api/roles${toQuery({ pageSize: 100, status: "ACTIVE", sort: "name", order: "asc" })}`
      ),
    ])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes?.data || []);
        setRoles(rolesRes?.data || []);
      })
      .catch(() => {
        setUsers([]);
        setRoles([]);
      });
  }, []);

  function toggleUser(id) {
    setSelectedUsers((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("userIds", next, { shouldValidate: true });
      return next;
    });
  }

  function toggleRole(id) {
    setSelectedRoles((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("roleIds", next, { shouldValidate: true });
      return next;
    });
  }

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit({
      ...values,
      userIds: selectedUsers,
      roleIds: selectedRoles,
    });
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
      </div>

      <TextField
        label="Descripcion"
        name="description"
        register={register}
        error={errors.description?.message}
      />

      <Field
        label="Miembros (usuarios activos)"
        error={errors.userIds?.message}
        hint={`${selectedUsers.length} seleccionado(s)`}
      >
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-border p-3">
          {users.length === 0 ? (
            <p className="text-sm text-content-muted">No hay usuarios activos.</p>
          ) : (
            users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-brand-600"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                />
                <span className="text-content">{user.name}</span>
                <span className="text-xs text-content-muted">{user.email}</span>
              </label>
            ))
          )}
        </div>
      </Field>

      <Field
        label="Roles del equipo"
        error={errors.roleIds?.message}
        hint="Se aplican a todos los miembros activos del equipo"
      >
        <div className="grid gap-1.5 rounded-[var(--radius-sm)] border border-border p-3 sm:grid-cols-2">
          {roles.length === 0 ? (
            <p className="text-sm text-content-muted">Cargando roles...</p>
          ) : (
            roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-brand-600"
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
                <span className="text-content">{role.name}</span>
                {role.isSystem && <Badge tone="neutral">Sistema</Badge>}
              </label>
            ))
          )}
        </div>
      </Field>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>
          {isEdit ? "Guardar cambios" : "Crear equipo"}
        </Button>
      </div>
    </form>
  );
}
