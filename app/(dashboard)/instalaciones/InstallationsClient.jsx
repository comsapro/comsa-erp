"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  installationConceptCreateSchema,
  PROCESS_UNITS,
  PROCESS_UNIT_LABELS,
} from "@/domains/catalogs/schemas";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceList } from "@/components/tables/ResourceList";
import { RowActions } from "@/components/tables/RowActions";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusBadge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import { STATUS_FILTER_OPTIONS, STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { formatDate } from "@/lib/utils/format";

const ENDPOINT = "/api/instalaciones";

function InstallationForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(installationConceptCreateSchema),
    defaultValues: {
      code: initial?.code || "",
      name: initial?.name || "",
      description: initial?.description || "",
      unit: initial?.unit || "SERVICE",
      defaultPrice: initial?.defaultPrice ?? 0,
      status: initial?.status || "ACTIVE",
    },
  });

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
        <TextField label="Codigo" name="code" register={register} error={errors.code?.message} required />
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
      </div>
      <TextareaField
        label="Descripcion"
        name="description"
        register={register}
        error={errors.description?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Unidad" name="unit" register={register} error={errors.unit?.message} required>
          {PROCESS_UNITS.map((unit) => (
            <option key={unit} value={unit}>{PROCESS_UNIT_LABELS[unit]}</option>
          ))}
        </SelectField>
        <TextField
          label="Precio por defecto"
          name="defaultPrice"
          type="number"
          step="0.01"
          min="0"
          register={register}
          error={errors.defaultPrice?.message}
        />
      </div>
      <SelectField label="Estatus" name="status" register={register} error={errors.status?.message}>
        {STATUS_FORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

export default function InstallationsClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: {
      created: "Concepto de instalacion creado",
      updated: "Concepto de instalacion actualizado",
      deleted: "Concepto de instalacion eliminado",
    },
  });

  const canEdit = has("installation_concepts.edit");
  const canDelete = has("installation_concepts.delete");

  const columns = [
    {
      key: "code",
      header: "Codigo",
      sortable: true,
      sortKey: "code",
      render: (r) => <span className="font-medium">{r.code}</span>,
    },
    { key: "name", header: "Nombre", sortable: true, sortKey: "name" },
    {
      key: "unit",
      header: "Unidad",
      render: (r) => PROCESS_UNIT_LABELS[r.unit] || r.unit || "-",
    },
    {
      key: "defaultPrice",
      header: "Precio",
      render: (r) => (r.defaultPrice != null ? Number(r.defaultPrice).toFixed(2) : "-"),
    },
    {
      key: "status",
      header: "Estatus",
      sortable: true,
      sortKey: "status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      header: "Creado",
      sortable: true,
      sortKey: "createdAt",
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-12",
      render: (r) => (
        <RowActions
          actions={[
            { label: "Editar", icon: Pencil, onClick: () => setModal({ open: true, record: r }), hidden: !canEdit },
            { label: "Eliminar", icon: Trash2, danger: true, onClick: () => setToDelete(r), hidden: !canDelete },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Conceptos de instalacion"
        description="Administra los conceptos de instalacion del sistema."
        actions={
          <Can permission="installation_concepts.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo concepto
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por codigo o nombre..."
        initialSort="code"
        initialOrder="asc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" }]}
        emptyTitle="Sin conceptos de instalacion"
        emptyDescription="Aun no se registran conceptos de instalacion."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar concepto" : "Nuevo concepto"}
      >
        <InstallationForm
          initial={modal.record}
          saving={saving}
          onSubmit={async (values) => {
            const result = await save(values, modal.record?.id);
            if (result?.ok) setModal({ open: false, record: null });
            return result;
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove(toDelete.id)}
        title="Eliminar concepto de instalacion"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
