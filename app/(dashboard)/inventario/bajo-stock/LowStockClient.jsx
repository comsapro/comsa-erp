"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { formatDate } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";

export default function LowStockClient() {
  const list = useResourceList("/api/inventario/bajo-stock", {
    initialSort: "availableQuantity",
    initialOrder: "asc",
    initialFilters: { warehouseId: "", itemType: "" },
  });

  const columns = useMemo(
    () => [
      { key: "sku", header: "SKU", render: (r) => r.item?.sku },
      { key: "name", header: "Item", render: (r) => r.item?.name },
      { key: "type", header: "Tipo", render: (r) => r.item?.itemType },
      { key: "wh", header: "Almacen", render: (r) => r.warehouse?.name },
      {
        key: "available",
        header: "Disponible",
        render: (r) => toNumber(r.availableQuantity),
      },
      {
        key: "min",
        header: "Minimo",
        render: (r) => toNumber(r.item?.minimumStock),
      },
      {
        key: "diff",
        header: "Diferencia",
        render: (r) => (
          <span className="font-medium text-danger-700">
            {toNumber(r.difference)}
          </span>
        ),
      },
      {
        key: "last",
        header: "Ultima entrada",
        render: (r) =>
          r.lastEntryDate ? formatDate(r.lastEntryDate) : "Sin entradas",
      },
      {
        key: "po",
        header: "Compras",
        render: (r) => (
          <Link
            href={`/ordenes-compra/nuevo?itemId=${r.itemId}`}
            className="text-sm text-brand-700 hover:underline"
          >
            Crear OC
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Alertas de stock bajo"
        description="Items con disponible menor o igual al minimo configurado."
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar SKU o nombre..."
        onRefresh={list.refresh}
        loading={list.loading}
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        sort={list.sort}
        onSort={list.toggleSort}
        emptyTitle="Sin alertas"
        emptyDescription="No hay items bajo el minimo de stock."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
