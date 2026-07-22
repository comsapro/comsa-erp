"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { issuingCompanyCreateSchema } from "@/domains/catalogs/schemas";
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

const ENDPOINT = "/api/empresas-emisoras";

function IssuingCompanyForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(issuingCompanyCreateSchema),
    defaultValues: {
      commercialName: initial?.commercialName || "",
      legalName: initial?.legalName || "",
      rfc: initial?.rfc || "",
      fiscalAddress: initial?.fiscalAddress || "",
      phone: initial?.phone || "",
      email: initial?.email || "",
      website: initial?.website || "",
      logoUrl: initial?.logoUrl || "",
      bankDetails: initial?.bankDetails || "",
      legalText: initial?.legalText || "",
      quotationFooter: initial?.quotationFooter || "",
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
        <TextField label="RFC" name="rfc" register={register} error={errors.rfc?.message} />
        <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
      </div>
      <TextareaField
        label="Domicilio fiscal"
        name="fiscalAddress"
        register={register}
        error={errors.fiscalAddress?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Correo"
          name="email"
          type="email"
          register={register}
          error={errors.email?.message}
        />
        <TextField
          label="Sitio web"
          name="website"
          register={register}
          error={errors.website?.message}
        />
      </div>
      <TextField
        label="URL del logo"
        name="logoUrl"
        register={register}
        error={errors.logoUrl?.message}
      />
      <TextareaField
        label="Datos bancarios"
        name="bankDetails"
        register={register}
        error={errors.bankDetails?.message}
      />
      <TextareaField
        label="Texto legal"
        name="legalText"
        register={register}
        error={errors.legalText?.message}
      />
      <TextareaField
        label="Pie de cotizacion"
        name="quotationFooter"
        register={register}
        error={errors.quotationFooter?.message}
      />
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

export default function IssuingCompaniesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: {
      created: "Empresa emisora creada",
      updated: "Empresa emisora actualizada",
      deleted: "Empresa emisora eliminada",
    },
  });

  const canEdit = has("issuing_companies.edit");
  const canDelete = has("issuing_companies.manage");

  const columns = [
    {
      key: "commercialName",
      header: "Nombre comercial",
      sortable: true,
      sortKey: "commercialName",
      render: (r) => <span className="font-medium">{r.commercialName}</span>,
    },
    { key: "legalName", header: "Razon social", render: (r) => r.legalName || "-" },
    { key: "rfc", header: "RFC", render: (r) => r.rfc || "-" },
    { key: "email", header: "Correo", render: (r) => r.email || "-" },
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
        title="Empresas emisoras"
        description="Administra las empresas emisoras del sistema."
        actions={
          <Can permission="issuing_companies.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nueva empresa
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por nombre, RFC o correo..."
        initialSort="commercialName"
        initialOrder="asc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" }]}
        emptyTitle="Sin empresas emisoras"
        emptyDescription="Aun no se registran empresas emisoras."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar empresa emisora" : "Nueva empresa emisora"}
        size="lg"
      >
        <IssuingCompanyForm
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
        title="Eliminar empresa emisora"
        description={`Se eliminara "${toDelete?.commercialName}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
