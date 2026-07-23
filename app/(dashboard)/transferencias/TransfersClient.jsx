"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils/format";
import {
  TRANSFER_STATUSES,
  TRANSFER_STATUS_LABELS,
} from "@/domains/transfers/constants";

export default function TransfersClient() {
  const list = useResourceList("/api/transferencias", {
    initialSort: "createdAt",
    initialFilters: { status: "" },
  });

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        render: (r) => (
          <Link
            href={`/transferencias/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "source",
        header: "Origen",
        render: (r) => r.sourceWarehouse?.name,
      },
      {
        key: "dest",
        header: "Destino",
        render: (r) => r.destinationWarehouse?.name,
      },
      {
        key: "status",
        header: "Estatus",
        render: (r) => (
          <Badge>{TRANSFER_STATUS_LABELS[r.status] || r.status}</Badge>
        ),
      },
      {
        key: "requested",
        header: "Solicitada",
        render: (r) =>
          r.requestedAt ? formatDateTime(r.requestedAt) : "—",
      },
      {
        key: "items",
        header: "Items",
        render: (r) => r.items?.length || 0,
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Transferencias entre almacenes"
        description="Solicita, aprueba y completa transferencias de inventario."
        actions={
          <Button as={Link} href="/transferencias/nuevo">
            <Plus className="h-4 w-4" /> Nueva transferencia
          </Button>
        }
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar folio..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.status ?? ""}
          onChange={(e) => list.setFilter("status", e.target.value)}
          className="w-48"
        >
          <option value="">Todos</option>
          {TRANSFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRANSFER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </TableToolbar>
      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        sort={list.sort}
        onSort={list.toggleSort}
        emptyTitle="Sin transferencias"
        emptyDescription="Crea una transferencia entre almacenes."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
