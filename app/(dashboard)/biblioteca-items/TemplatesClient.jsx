"use client";

import { useRef, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceList } from "@/components/tables/ResourceList";
import { RowActions } from "@/components/tables/RowActions";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusBadge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { STATUS_FILTER_OPTIONS } from "@/lib/constants/ui";
import TemplateForm from "./TemplateForm";

const ENDPOINT = "/api/biblioteca-items";

export default function TemplatesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const { toast } = useToast();
  const [modal, setModal] = useState({ open: false, record: null });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: {
      created: "Plantilla creada",
      updated: "Plantilla actualizada",
      deleted: "Plantilla eliminada",
    },
  });

  const canEdit = has("quote_templates.edit");
  const canDelete = has("quote_templates.delete");
  const canCreate = has("quote_templates.create");

  const openCreate = () => setModal({ open: true, record: null });

  const openEdit = async (row) => {
    setLoadingDetail(true);
    try {
      const detail = await api.get(`${ENDPOINT}/${row.id}`);
      setModal({ open: true, record: detail });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo cargar",
        description: error.message,
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const duplicate = async (row) => {
    setDuplicatingId(row.id);
    try {
      await api.post(`${ENDPOINT}/${row.id}/duplicar`);
      toast({ variant: "success", title: "Plantilla duplicada" });
      listRef.current?.refresh();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo duplicar",
        description: error.message,
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortKey: "name",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "category",
      header: "Categoria",
      sortable: true,
      sortKey: "category",
      render: (r) => r.category || "-",
    },
    {
      key: "benefitPercentage",
      header: "Beneficio",
      render: (r) =>
        r.benefitPercentage != null ? `${Number(r.benefitPercentage)}%` : "-",
    },
    {
      key: "status",
      header: "Estatus",
      sortable: true,
      sortKey: "status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-12",
      render: (r) => (
        <RowActions
          actions={[
            {
              label: "Editar",
              icon: Pencil,
              onClick: () => openEdit(r),
              hidden: !canEdit,
            },
            {
              label: duplicatingId === r.id ? "Duplicando..." : "Duplicar",
              icon: Copy,
              onClick: () => duplicate(r),
              hidden: !canCreate,
            },
            {
              label: "Eliminar",
              icon: Trash2,
              danger: true,
              onClick: () => setToDelete(r),
              hidden: !canDelete,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Biblioteca de items"
        description="Plantillas reutilizables para armar cotizaciones."
        actions={
          <Can permission="quote_templates.create">
            <Button onClick={openCreate} loading={loadingDetail}>
              <Plus className="h-4 w-4" /> Nueva plantilla
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por nombre, categoria o descripcion..."
        initialSort="name"
        initialOrder="asc"
        filters={[
          {
            key: "status",
            label: "Estatus",
            options: STATUS_FILTER_OPTIONS,
            defaultValue: "",
          },
        ]}
        emptyTitle="Sin plantillas"
        emptyDescription="Aun no hay items en la biblioteca."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar plantilla" : "Nueva plantilla"}
        size="lg"
      >
        <TemplateForm
          key={modal.record?.id || "new"}
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
        title="Eliminar plantilla"
        description={`Se eliminara "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
