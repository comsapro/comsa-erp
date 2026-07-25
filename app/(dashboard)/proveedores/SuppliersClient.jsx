"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import {
  supplierCreateSchema,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
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

const ENDPOINT = "/api/proveedores";

function SupplierForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      legalName: initial?.legalName || "",
      rfc: initial?.rfc || "",
      contactName: initial?.contactName || "",
      phone: initial?.phone || "",
      email: initial?.email || "",
      address: initial?.address || "",
      supplierType: initial?.supplierType || "",
      productsServices: initial?.productsServices || "",
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
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <TextField label="Razon social" name="legalName" register={register} error={errors.legalName?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="RFC" name="rfc" register={register} error={errors.rfc?.message} />
        <SelectField label="Tipo de proveedor" name="supplierType" register={register} error={errors.supplierType?.message}>
          <option value="">Sin especificar</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Contacto" name="contactName" register={register} error={errors.contactName?.message} />
        <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
      </div>
      <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} />
      <TextField label="Direccion" name="address" register={register} error={errors.address?.message} />
      <TextareaField label="Productos / servicios" name="productsServices" register={register} error={errors.productsServices?.message} />
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

export default function SuppliersClient() {
  const router = useRouter();
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Proveedor creado", updated: "Proveedor actualizado", deleted: "Proveedor eliminado" },
  });

  const canEdit = has("suppliers.edit");
  const canDelete = has("suppliers.delete");
  const canView = has("suppliers.view");

  const columns = [
    { key: "name", header: "Nombre", sortable: true, sortKey: "name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "rfc", header: "RFC", render: (r) => r.rfc || "-" },
    { key: "contactName", header: "Contacto", render: (r) => r.contactName || "-" },
    { key: "supplierType", header: "Tipo", render: (r) => (r.supplierType ? SUPPLIER_TYPE_LABELS[r.supplierType] : "-") },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      headerClassName: "w-12",
      render: (r) => (
        <RowActions
          actions={[
            { label: "Ver perfil", icon: Eye, onClick: () => router.push(`/proveedores/${r.id}`), hidden: !canView },
            { label: "Editar", icon: Pencil, onClick: () => setModal({ open: true, record: r }), hidden: !canEdit },
            { label: "Eliminar", icon: Trash2, danger: true, onClick: () => setToDelete(r), hidden: !canDelete },
          ]}
        />
      ),
    },
  ];

  const typeOptions = [
    { value: "", label: "Todos los tipos" },
    ...SUPPLIER_TYPES.map((t) => ({ value: t, label: SUPPLIER_TYPE_LABELS[t] })),
  ];

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description="Administra los proveedores de productos y servicios."
        actions={
          <Can permission="suppliers.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo proveedor
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por nombre, RFC o contacto..."
        initialSort="name"
        initialOrder="asc"
        filters={[
          { key: "supplierType", label: "Tipo", options: typeOptions, defaultValue: "" },
          { key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" },
        ]}
        emptyTitle="Sin proveedores"
        emptyDescription="Aun no se registran proveedores."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar proveedor" : "Nuevo proveedor"}
        size="lg"
      >
        <SupplierForm
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
        title="Eliminar proveedor"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
