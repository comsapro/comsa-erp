"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoryCreateSchema } from "@/domains/catalogs/schemas";
import { api } from "@/lib/api/client";
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
import { CategoryCatalogSelect } from "@/components/forms/catalog-selects";
import { STATUS_FILTER_OPTIONS, STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { formatDate } from "@/lib/utils/format";

const ENDPOINT = "/api/categorias";

function CategoryForm({ initial, options, onOptionsChange, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      description: initial?.description || "",
      parentId: initial?.parentId || "",
      status: initial?.status || "ACTIVE",
    },
  });

  const parentId = useWatch({ control, name: "parentId" });

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
      <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
      <CategoryCatalogSelect
        label="Categoria padre"
        value={parentId || ""}
        onChange={(id) => setValue("parentId", id || "")}
        options={options}
        onOptionsChange={onOptionsChange}
        excludeId={initial?.id}
        error={errors.parentId?.message}
        clearLabel="Sin categoria padre"
      />
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

export default function CategoriesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const [options, setOptions] = useState([]);

  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => {
      listRef.current?.refresh();
      loadOptions();
    },
    labels: { created: "Categoria creada", updated: "Categoria actualizada", deleted: "Categoria eliminada" },
  });

  function loadOptions() {
    api
      .get(`${ENDPOINT}?pageSize=100&status=ACTIVE&sort=name&order=asc`)
      .then((res) => setOptions(res?.data || []))
      .catch(() => setOptions([]));
  }

  useEffect(() => {
    loadOptions();
  }, []);

  const canEdit = has("categories.edit");
  const canDelete = has("categories.delete");

  const columns = [
    { key: "name", header: "Nombre", sortable: true, sortKey: "name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "parent", header: "Categoria padre", render: (r) => r.parent?.name || "-" },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "Creada", sortable: true, sortKey: "createdAt", render: (r) => formatDate(r.createdAt) },
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
        title="Categorias de productos"
        description="Organiza los productos e insumos en categorias."
        actions={
          <Can permission="categories.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nueva categoria
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar categorias..."
        initialSort="name"
        initialOrder="asc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" }]}
        emptyTitle="Sin categorias"
        emptyDescription="Aun no se registran categorias."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar categoria" : "Nueva categoria"}
      >
        <CategoryForm
          initial={modal.record}
          options={options}
          onOptionsChange={setOptions}
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
        title="Eliminar categoria"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
