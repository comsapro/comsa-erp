"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceList } from "@/components/tables/ResourceList";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils/format";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_MODULE_LABELS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_MODULE_OPTIONS,
} from "@/lib/audit/labels";

const ENDPOINT = "/api/bitacora";

export default function AuditClient() {
  const columns = [
    {
      key: "createdAt",
      header: "Fecha",
      sortable: true,
      sortKey: "createdAt",
      render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span>,
    },
    { key: "user", header: "Usuario", render: (r) => r.user?.name || "Sistema" },
    {
      key: "module",
      header: "Modulo",
      sortable: true,
      sortKey: "module",
      render: (r) => AUDIT_MODULE_LABELS[r.module] || r.module,
    },
    { key: "entity", header: "Entidad", render: (r) => r.entity },
    {
      key: "action",
      header: "Accion",
      sortable: true,
      sortKey: "action",
      render: (r) => (
        <Badge tone={AUDIT_ACTION_TONES[r.action] || "neutral"}>
          {AUDIT_ACTION_LABELS[r.action] || r.action}
        </Badge>
      ),
    },
    {
      key: "ipAddress",
      header: "IP",
      render: (r) => <span className="text-content-muted">{r.ipAddress || "-"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bitacora"
        description="Registro de actividad y cambios importantes del sistema."
      />

      <ResourceList
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Buscar por entidad o ID..."
        initialSort="createdAt"
        initialOrder="desc"
        filters={[
          { key: "module", label: "Modulo", options: AUDIT_MODULE_OPTIONS, defaultValue: "" },
          { key: "action", label: "Accion", options: AUDIT_ACTION_OPTIONS, defaultValue: "" },
        ]}
        emptyTitle="Sin registros"
        emptyDescription="Aun no hay actividad registrada."
      />
    </div>
  );
}
