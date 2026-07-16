"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { warehouseCreateSchema } from "@/domains/catalogs/schemas";
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

const ENDPOINT = "/api/almacenes";

function WarehouseForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(warehouseCreateSchema),
    defaultValues: {
      code: initial?.code || "",
      name: initial?.name || "",
      description: initial?.description || "",
      location: initial?.location || "",
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
      <TextField label="Ubicacion" name="location" register={register} error={errors.location?.message} />
      <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />
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

export default function WarehousesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Almacen creado", updated: "Almacen actualizado", deleted: "Almacen eliminado" },
  });

  const canEdit = has("warehouses.edit");
  const canDelete = has("warehouses.delete");

  const columns = [
    { key: "code", header: "Codigo", sortable: true, sortKey: "code", render: (r) => <span className="font-medium">{r.code}</span> },
    { key: "name", header: "Nombre", sortable: true, sortKey: "name" },
    { key: "location", header: "Ubicacion", render: (r) => r.location || "-" },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "Creado", sortable: true, sortKey: "createdAt", render: (r) => formatDate(r.createdAt) },
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
        title="Almacenes"
        description="Administra los almacenes del sistema."
        actions={
          <Can permission="warehouses.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo almacen
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por codigo, nombre o ubicacion..."
        initialSort="code"
        initialOrder="asc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" }]}
        emptyTitle="Sin almacenes"
        emptyDescription="Aun no se registran almacenes."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar almacen" : "Nuevo almacen"}
      >
        <WarehouseForm
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
        title="Eliminar almacen"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
