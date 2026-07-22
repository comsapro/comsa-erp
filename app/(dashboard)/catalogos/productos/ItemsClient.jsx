"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  itemCreateSchema,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
} from "@/domains/catalogs/schemas";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceList } from "@/components/tables/ResourceList";
import { RowActions } from "@/components/tables/RowActions";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
} from "@/components/forms/fields";
import { CategoryCatalogSelect } from "@/components/forms/catalog-selects";
import { STATUS_FILTER_OPTIONS, STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { formatDate } from "@/lib/utils/format";

const ENDPOINT = "/api/items";

function ItemForm({ initial, categories, onCategoriesChange, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(itemCreateSchema),
    defaultValues: {
      sku: initial?.sku || "",
      name: initial?.name || "",
      description: initial?.description || "",
      itemType: initial?.itemType || "PRODUCT",
      categoryId: initial?.categoryId || "",
      unitOfMeasure: initial?.unitOfMeasure || "",
      minimumStock: initial?.minimumStock ?? 0,
      isInventoryControlled: initial?.isInventoryControlled ?? true,
      status: initial?.status || "ACTIVE",
    },
  });

  const categoryId = useWatch({ control, name: "categoryId" });

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
        <TextField label="SKU" name="sku" register={register} error={errors.sku?.message} required />
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Tipo" name="itemType" register={register} error={errors.itemType?.message} required>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
          ))}
        </SelectField>
        <CategoryCatalogSelect
          value={categoryId || ""}
          onChange={(id) => setValue("categoryId", id || "")}
          options={categories}
          onOptionsChange={onCategoriesChange}
          error={errors.categoryId?.message}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Unidad de medida" name="unitOfMeasure" register={register} error={errors.unitOfMeasure?.message} placeholder="pza, kg, m..." />
        <TextField label="Stock minimo" name="minimumStock" type="number" step="0.001" min="0" register={register} error={errors.minimumStock?.message} />
      </div>
      <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />
      <CheckboxField
        label="Controlar inventario"
        name="isInventoryControlled"
        register={register}
        hint="Si se activa, el item se controla en almacen."
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

export default function ItemsClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const [categories, setCategories] = useState([]);

  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Item creado", updated: "Item actualizado", deleted: "Item eliminado" },
  });

  useEffect(() => {
    api
      .get("/api/categorias?pageSize=100&status=ACTIVE&sort=name&order=asc")
      .then((res) => setCategories(res?.data || []))
      .catch(() => setCategories([]));
  }, []);

  const canEdit = has("items.edit");
  const canDelete = has("items.delete");

  const columns = [
    { key: "sku", header: "SKU", sortable: true, sortKey: "sku", render: (r) => <span className="font-medium">{r.sku}</span> },
    { key: "name", header: "Nombre", sortable: true, sortKey: "name" },
    { key: "itemType", header: "Tipo", sortable: true, sortKey: "itemType", render: (r) => <Badge tone="brand">{ITEM_TYPE_LABELS[r.itemType] || r.itemType}</Badge> },
    { key: "category", header: "Categoria", render: (r) => r.category?.name || "-" },
    { key: "unitOfMeasure", header: "Unidad", render: (r) => r.unitOfMeasure || "-" },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
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

  const typeOptions = [
    { value: "", label: "Todos los tipos" },
    ...ITEM_TYPES.map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t] })),
  ];

  return (
    <div>
      <PageHeader
        title="Productos e insumos"
        description="Catalogo unico de productos, materia prima, consumibles y mas."
        actions={
          <Can permission="items.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo item
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por SKU o nombre..."
        initialSort="createdAt"
        initialOrder="desc"
        filters={[
          { key: "itemType", label: "Tipo", options: typeOptions, defaultValue: "" },
          { key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" },
        ]}
        emptyTitle="Sin items"
        emptyDescription="Aun no se registran productos ni insumos."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar item" : "Nuevo item"}
        size="lg"
      >
        <ItemForm
          initial={modal.record}
          categories={categories}
          onCategoriesChange={setCategories}
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
        title="Eliminar item"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
