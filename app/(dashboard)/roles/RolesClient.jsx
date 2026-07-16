"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceList } from "@/components/tables/ResourceList";
import { RowActions } from "@/components/tables/RowActions";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { STATUS_FILTER_OPTIONS } from "@/lib/constants/ui";
import RoleForm from "./RoleForm";

const ENDPOINT = "/api/roles";

export default function RolesClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const { toast } = useToast();
  const [modal, setModal] = useState({ open: false, record: null });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Rol creado", updated: "Rol actualizado", deleted: "Rol eliminado" },
  });

  const canEdit = has("roles.edit");
  const canDelete = has("roles.delete");

  const openEdit = async (row) => {
    setLoadingDetail(true);
    try {
      const detail = await api.get(`${ENDPOINT}/${row.id}`);
      setModal({ open: true, record: detail });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo cargar", description: error.message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Rol",
      sortable: true,
      sortKey: "name",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.isSystem && <Badge tone="neutral">Sistema</Badge>}
        </div>
      ),
    },
    { key: "description", header: "Descripcion", render: (r) => r.description || "-" },
    { key: "permissions", header: "Permisos", render: (r) => <Badge tone="brand">{r._count?.permissions ?? 0}</Badge> },
    { key: "users", header: "Usuarios", render: (r) => <Badge tone="neutral">{r._count?.users ?? 0}</Badge> },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      headerClassName: "w-12",
      render: (r) => (
        <RowActions
          actions={[
            { label: "Editar", icon: Pencil, onClick: () => openEdit(r), hidden: !canEdit },
            {
              label: "Eliminar",
              icon: Trash2,
              danger: true,
              onClick: () => setToDelete(r),
              hidden: !canDelete || r.isSystem,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Roles y permisos"
        description="Define roles y los permisos por modulo que otorgan."
        actions={
          <Can permission="roles.create">
            <Button onClick={() => setModal({ open: true, record: null })} loading={loadingDetail}>
              <Plus className="h-4 w-4" /> Nuevo rol
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar roles..."
        initialSort="name"
        initialOrder="asc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "" }]}
        emptyTitle="Sin roles"
        emptyDescription="Aun no se registran roles."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar rol" : "Nuevo rol"}
        size="lg"
      >
        <RoleForm
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
        title="Eliminar rol"
        description={`Se eliminara el rol "${toDelete?.name}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
