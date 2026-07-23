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
import { Can } from "@/components/permissions/Can";
import { formatDate, formatMoney } from "@/lib/utils/format";
import {
  PO_STATUSES,
  PO_STATUS_LABELS,
} from "@/domains/purchase-orders/constants";

export default function PurchaseOrdersClient() {
  const list = useResourceList("/api/ordenes-compra", {
    initialSort: "requestDate",
    initialFilters: { status: "", supplierId: "" },
  });

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        sortable: true,
        sortKey: "folio",
        render: (r) => (
          <Link
            href={`/ordenes-compra/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "supplier",
        header: "Proveedor",
        render: (r) => r.supplier?.name,
      },
      {
        key: "date",
        header: "Solicitud",
        sortable: true,
        sortKey: "requestDate",
        render: (r) => formatDate(r.requestDate),
      },
      {
        key: "status",
        header: "Estatus",
        render: (r) => (
          <Badge>{PO_STATUS_LABELS[r.status] || r.status}</Badge>
        ),
      },
      {
        key: "total",
        header: "Total",
        sortable: true,
        sortKey: "total",
        render: (r) => formatMoney(r.total),
      },
      {
        key: "prod",
        header: "Produccion",
        render: (r) => r.productionOrder?.folio || "—",
      },
      {
        key: "req",
        header: "Solicitante",
        render: (r) => r.requestedByUser?.name,
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Ordenes de compra"
        description="Solicitud, aprobacion y seguimiento de compras."
        actions={
          <Can permission="purchase_orders.create">
            <Button as={Link} href="/ordenes-compra/nuevo">
              <Plus className="h-4 w-4" /> Nueva OC
            </Button>
          </Can>
        }
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar folio o proveedor..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.status ?? ""}
          onChange={(e) => list.setFilter("status", e.target.value)}
          className="w-52"
        >
          <option value="">Todos los estatus</option>
          {PO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PO_STATUS_LABELS[s]}
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
        emptyTitle="Sin ordenes de compra"
        emptyDescription="Crea una orden de compra para comenzar."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
