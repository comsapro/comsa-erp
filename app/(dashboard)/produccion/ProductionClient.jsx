"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { RowActions } from "@/components/tables/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
  PRODUCTION_SOURCE_LABELS,
} from "@/domains/production/constants";

const ENDPOINT = "/api/produccion";

const TABS = [
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completadas" },
  { value: "all", label: "Todas" },
];

function sourceFolio(row) {
  if (row.sourceType === "QUOTE") return row.quote?.folio || "-";
  if (row.sourceType === "DIRECT_ORDER") return row.directOrder?.folio || "-";
  return "-";
}

export default function ProductionClient() {
  const router = useRouter();
  const list = useResourceList(ENDPOINT, {
    initialSort: "createdAt",
    initialOrder: "desc",
    initialFilters: { tab: "in_progress", sourceType: "" },
  });

  const activeTab = list.filters.tab ?? "in_progress";

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        sortable: true,
        sortKey: "folio",
        render: (r) => (
          <Link
            href={`/produccion/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "sourceFolio",
        header: "Origen",
        render: (r) => (
          <span>
            <span className="text-content-muted">
              {PRODUCTION_SOURCE_LABELS[r.sourceType] || r.sourceType}:{" "}
            </span>
            {sourceFolio(r)}
          </span>
        ),
      },
      {
        key: "client",
        header: "Cliente",
        render: (r) => r.client?.commercialName || "-",
      },
      {
        key: "progress",
        header: "Avance",
        sortable: true,
        sortKey: "progressPercentage",
        render: (r) => (
          <span>
            {r.completedItems}/{r.totalItems} ({Number(r.progressPercentage)}%)
          </span>
        ),
      },
      {
        key: "status",
        header: "Estatus",
        sortable: true,
        sortKey: "status",
        render: (r) => (
          <Badge tone={PRODUCTION_STATUS_TONES[r.status] || "neutral"}>
            {PRODUCTION_STATUS_LABELS[r.status] || r.status}
          </Badge>
        ),
      },
      {
        key: "sourceType",
        header: "Tipo",
        render: (r) => PRODUCTION_SOURCE_LABELS[r.sourceType] || r.sourceType,
      },
      {
        key: "approvalDate",
        header: "Aprobacion",
        sortable: true,
        sortKey: "approvalDate",
        render: (r) => formatDate(r.approvalDate),
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
                onClick: () => router.push(`/produccion/${r.id}`),
              },
            ]}
          />
        ),
      },
    ],
    [router]
  );

  return (
    <div>
      <PageHeader
        title="Ordenes de produccion"
        description="Seguimiento de avance de produccion desde cotizaciones u ordenes directas."
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => list.setFilter("tab", tab.value)}
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
        searchPlaceholder="Buscar por folio, origen o cliente..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.sourceType ?? ""}
          onChange={(e) => list.setFilter("sourceType", e.target.value)}
          className="w-44"
          aria-label="Tipo de origen"
        >
          <option value="">Todos los origenes</option>
          <option value="QUOTE">Cotizacion</option>
          <option value="DIRECT_ORDER">Orden directa</option>
        </Select>
      </TableToolbar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        sort={list.sort}
        onSort={list.toggleSort}
        emptyTitle="Sin ordenes de produccion"
        emptyDescription="Aun no hay ordenes con estos criterios."
      />

      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
