"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  manufacturingProcessCreateSchema,
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

const ENDPOINT = "/api/procesos";

function ProcessForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(manufacturingProcessCreateSchema),
    defaultValues: {
      code: initial?.code || "",
      name: initial?.name || "",
      description: initial?.description || "",
      unit: initial?.unit || "HOUR",
      defaultRate: initial?.defaultRate ?? 0,
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
          label="Tarifa por defecto"
          name="defaultRate"
          type="number"
          step="0.01"
          min="0"
          register={register}
          error={errors.defaultRate?.message}
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

export default function ProcessesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: {
      created: "Proceso creado",
      updated: "Proceso actualizado",
      deleted: "Proceso eliminado",
    },
  });

  const canEdit = has("manufacturing_processes.edit");
  const canDelete = has("manufacturing_processes.delete");

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
      key: "defaultRate",
      header: "Tarifa",
      render: (r) => (r.defaultRate != null ? Number(r.defaultRate).toFixed(2) : "-"),
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
        title="Procesos de manufactura"
        description="Administra los procesos de manufactura del sistema."
        actions={
          <Can permission="manufacturing_processes.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo proceso
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
        emptyTitle="Sin procesos"
        emptyDescription="Aun no se registran procesos de manufactura."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar proceso" : "Nuevo proceso"}
      >
        <ProcessForm
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
        title="Eliminar proceso"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
