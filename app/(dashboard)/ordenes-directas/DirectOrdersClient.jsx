"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { RowActions } from "@/components/tables/RowActions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  DIRECT_ORDER_STATUSES,
  DIRECT_ORDER_STATUS_LABELS,
  DIRECT_ORDER_STATUS_TONES,
  ORDER_TYPE_LABELS,
} from "@/domains/direct-orders/constants";
import { ViewModeToggle } from "@/components/views/ViewModeToggle";
import { StatusKanban } from "@/components/views/StatusKanban";
import { MonthCalendar } from "@/components/views/MonthCalendar";
import { useViewMode } from "@/components/views/useViewMode";

const ENDPOINT = "/api/ordenes-directas";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  ...DIRECT_ORDER_STATUSES.map((status) => ({
    value: status,
    label: DIRECT_ORDER_STATUS_LABELS[status],
  })),
];

const KANBAN_COLUMNS = DIRECT_ORDER_STATUSES.map((id) => ({
  id,
  label: DIRECT_ORDER_STATUS_LABELS[id],
  tone: DIRECT_ORDER_STATUS_TONES[id] || "neutral",
}));

export default function DirectOrdersClient() {
  const router = useRouter();
  const { mode, setMode } = useViewMode("direct-orders:viewMode");
  const list = useResourceList(ENDPOINT, {
    initialSort: "createdAt",
    initialOrder: "desc",
    initialFilters: { status: "" },
    pageSize: mode === "table" ? 10 : 200,
  });

  const activeStatus = list.filters.status ?? "";

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        sortable: true,
        sortKey: "folio",
        render: (r) => (
          <Link
            href={`/ordenes-directas/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "client",
        header: "Cliente",
        render: (r) => r.client?.commercialName || "-",
      },
      {
        key: "orderType",
        header: "Tipo",
        render: (r) => ORDER_TYPE_LABELS[r.orderType] || r.orderType,
      },
      {
        key: "requestDate",
        header: "Solicitud",
        sortable: true,
        sortKey: "requestDate",
        render: (r) => formatDate(r.requestDate),
      },
      {
        key: "seller",
        header: "Vendedor",
        render: (r) => r.seller?.name || "-",
      },
      {
        key: "status",
        header: "Estatus",
        sortable: true,
        sortKey: "status",
        render: (r) => (
          <Badge tone={DIRECT_ORDER_STATUS_TONES[r.status] || "neutral"}>
            {DIRECT_ORDER_STATUS_LABELS[r.status] || r.status}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "",
        headerClassName: "w-12",
        render: (r) => (
          <RowActions
            actions={[
              {
                label: "Ver detalle",
                icon: Eye,
                onClick: () => router.push(`/ordenes-directas/${r.id}`),
              },
            ]}
          />
        ),
      },
    ],
    [router]
  );

  const kanbanColumns = useMemo(() => {
    if (activeStatus) {
      return KANBAN_COLUMNS.filter((c) => c.id === activeStatus);
    }
    return KANBAN_COLUMNS;
  }, [activeStatus]);

  return (
    <div>
      <PageHeader
        title="Ordenes directas"
        description="Ordenes sin cotizacion previa: captura, aprobacion y envio a produccion o cotizacion."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewModeToggle value={mode} onChange={setMode} />
            <Can permission="direct_orders.create">
              <Button as={Link} href="/ordenes-directas/nuevo">
                <Plus className="h-4 w-4" /> Nueva orden
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = activeStatus === tab.value;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => list.setFilter("status", tab.value)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-content-muted hover:text-content"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar por folio, requisicion o cliente..."
        onRefresh={list.refresh}
        loading={list.loading}
      />

      {mode === "table" && (
        <>
          <DataTable
            columns={columns}
            rows={list.rows}
            loading={list.loading}
            error={list.error}
            sort={list.sort}
            onSort={list.toggleSort}
            emptyTitle="Sin ordenes directas"
            emptyDescription="Aun no se registran ordenes directas."
          />
          <Pagination
            pagination={list.pagination}
            onPageChange={list.setPage}
            loading={list.loading}
          />
        </>
      )}

      {mode === "kanban" && (
        <StatusKanban
          columns={kanbanColumns}
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          getStatus={(r) => r.status}
          getHref={(r) => `/ordenes-directas/${r.id}`}
          getTitle={(r) => r.folio}
          getSubtitle={(r) => r.client?.commercialName || "Sin cliente"}
          getDate={(r) => r.requestDate}
          emptyTitle="Sin ordenes directas"
          emptyDescription="Aun no se registran ordenes directas."
        />
      )}

      {mode === "calendar" && (
        <MonthCalendar
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          getDate={(r) => r.requestDate}
          getHref={(r) => `/ordenes-directas/${r.id}`}
          getTitle={(r) => r.folio}
          getSubtitle={(r) =>
            `${r.client?.commercialName || "Sin cliente"} · ${
              DIRECT_ORDER_STATUS_LABELS[r.status] || r.status
            }`
          }
          emptyTitle="Sin ordenes"
          emptyDescription="No hay ordenes directas en este dia."
        />
      )}
    </div>
  );
}
