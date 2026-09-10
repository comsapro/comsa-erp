"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { STATUS_FILTER_OPTIONS } from "@/lib/constants/ui";
import { formatDateTime } from "@/lib/utils/format";
import UserForm from "./UserForm";

const ENDPOINT = "/api/usuarios";

export default function UsersClient() {
  const listRef = useRef(null);
  const { has } = usePermissions();
  const [modal, setModal] = useState({ open: false, record: null });
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Usuario creado", updated: "Usuario actualizado", deleted: "Usuario eliminado" },
  });

  const canEdit = has("users.edit");
  const canDelete = has("users.delete");

  const columns = [
    { key: "name", header: "Nombre", sortable: true, sortKey: "name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", header: "Correo", sortable: true, sortKey: "email" },
    {
      key: "roles",
      header: "Roles",
      render: (r) => {
        const direct = r.directRoles || r.roles || [];
        const viaTeam = r.teamRoles || [];
        if (!direct.length && !viaTeam.length) {
          return <span className="text-content-muted">Sin roles</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {direct.map((role) => (
              <Badge key={`d-${role.id}`} tone="brand">
                {role.name}
              </Badge>
            ))}
            {viaTeam.map((role) => (
              <Badge key={`t-${role.teamId}-${role.id}`} tone="neutral">
                {role.name} · {role.teamName}
              </Badge>
            ))}
          </div>
        );
      },
    },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "lastLoginAt", header: "Ultimo acceso", sortable: true, sortKey: "lastLoginAt", render: (r) => formatDateTime(r.lastLoginAt) },
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
        title="Usuarios"
        description="Administra las cuentas de acceso al sistema."
        actions={
          <Can permission="users.create">
            <Button onClick={() => setModal({ open: true, record: null })}>
              <Plus className="h-4 w-4" /> Nuevo usuario
            </Button>
          </Can>
        }
      />

      <ResourceList
        ref={listRef}
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por nombre o correo..."
        initialSort="createdAt"
        initialOrder="desc"
        filters={[{ key: "status", label: "Estatus", options: STATUS_FILTER_OPTIONS, defaultValue: "ACTIVE" }]}
        emptyTitle="Sin usuarios"
        emptyDescription="Aun no se registran usuarios."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar usuario" : "Nuevo usuario"}
        size="lg"
      >
        <UserForm
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
        title="Eliminar usuario"
        description={`Se eliminara "${toDelete?.name}". No podra iniciar sesion.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
