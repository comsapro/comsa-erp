"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Can } from "@/components/permissions/Can";
import { formatDateTime } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
} from "@/domains/inventory/constants";

export default function MovementsClient() {
  const list = useResourceList("/api/inventario/movimientos", {
    initialSort: "movementDate",
    initialFilters: { movementType: "", warehouseId: "", itemId: "" },
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
            href={`/inventario/movimientos/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "date",
        header: "Fecha",
        sortable: true,
        sortKey: "movementDate",
        render: (r) => formatDateTime(r.movementDate),
      },
      {
        key: "type",
        header: "Tipo",
        render: (r) => MOVEMENT_TYPE_LABELS[r.movementType] || r.movementType,
      },
      { key: "wh", header: "Almacen", render: (r) => r.warehouse?.name },
      {
        key: "item",
        header: "Item",
        render: (r) => `${r.item?.sku || ""} — ${r.item?.name || ""}`,
      },
      {
        key: "qty",
        header: "Cantidad",
        sortable: true,
        sortKey: "quantity",
        render: (r) => toNumber(r.quantity),
      },
      {
        key: "ref",
        header: "Referencia",
        render: (r) => r.referenceType || "—",
      },
      { key: "user", header: "Usuario", render: (r) => r.createdByUser?.name },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Movimientos de inventario"
        description="Libro inmutable de entradas, salidas y ajustes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can permission="inventory.create_entry">
              <Button as={Link} href="/inventario/movimientos/entrada">
                Entrada
              </Button>
            </Can>
            <Can permission="inventory.create_exit">
              <Button
                as={Link}
                href="/inventario/movimientos/salida"
                variant="secondary"
              >
                Salida
              </Button>
            </Can>
            <Can permission="inventory.adjust">
              <Button
                as={Link}
                href="/inventario/movimientos/ajuste"
                variant="secondary"
              >
                Ajuste
              </Button>
            </Can>
          </div>
        }
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar folio, SKU o notas..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.movementType ?? ""}
          onChange={(e) => list.setFilter("movementType", e.target.value)}
          className="w-48"
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t]}
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
        emptyTitle="Sin movimientos"
        emptyDescription="Aun no hay movimientos registrados."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
