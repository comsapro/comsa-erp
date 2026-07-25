"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
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
import ClientForm from "./ClientForm";

const ENDPOINT = "/api/clientes";

export default function ClientsClient() {
  const router = useRouter();
  const listRef = useRef(null);
  const { has } = usePermissions();
  const { toast } = useToast();
  const [modal, setModal] = useState({ open: false, record: null });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const { save, remove, saving } = useCrudActions(ENDPOINT, {
    onDone: () => listRef.current?.refresh(),
    labels: { created: "Cliente creado", updated: "Cliente actualizado", deleted: "Cliente eliminado" },
  });

  const canEdit = has("clients.edit");
  const canDelete = has("clients.delete");
  const canView = has("clients.view");

  const openCreate = () => setModal({ open: true, record: null });

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
    { key: "commercialName", header: "Nombre comercial", sortable: true, sortKey: "commercialName", render: (r) => <span className="font-medium">{r.commercialName}</span> },
    { key: "rfc", header: "RFC", render: (r) => r.rfc || "-" },
    { key: "email", header: "Correo", render: (r) => r.email || "-" },
    { key: "contacts", header: "Contactos", render: (r) => <Badge tone="neutral">{r._count?.contacts ?? 0}</Badge> },
    { key: "status", header: "Estatus", sortable: true, sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      headerClassName: "w-12",
      render: (r) => (
        <RowActions
          actions={[
            { label: "Ver perfil", icon: Eye, onClick: () => router.push(`/clientes/${r.id}`), hidden: !canView },
            { label: "Editar", icon: Pencil, onClick: () => openEdit(r), hidden: !canEdit },
            { label: "Eliminar", icon: Trash2, danger: true, onClick: () => setToDelete(r), hidden: !canDelete },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Administra los clientes y sus contactos."
        actions={
          <Can permission="clients.create">
            <Button onClick={openCreate} loading={loadingDetail}>
              <Plus className="h-4 w-4" /> Nuevo cliente
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
        emptyTitle="Sin clientes"
        emptyDescription="Aun no se registran clientes."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? "Editar cliente" : "Nuevo cliente"}
        size="xl"
      >
        <ClientForm
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
        title="Eliminar cliente"
        description={`Se eliminara "${toDelete?.commercialName}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
