"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Can } from "@/components/permissions/Can";
import { toNumber } from "@/lib/quotes/calculations";

export default function InventoryStockClient() {
  const list = useResourceList("/api/inventario", {
    initialSort: "updatedAt",
    initialFilters: { warehouseId: "", itemType: "", lowStock: "" },
  });

  const columns = useMemo(
    () => [
      {
        key: "sku",
        header: "SKU",
        render: (r) => (
          <span className="font-medium text-brand-700">{r.item?.sku}</span>
        ),
      },
      { key: "item", header: "Item", render: (r) => r.item?.name || "-" },
      { key: "type", header: "Tipo", render: (r) => r.item?.itemType || "-" },
      {
        key: "warehouse",
        header: "Almacen",
        render: (r) => r.warehouse?.name || "-",
      },
      {
        key: "quantity",
        header: "Cantidad",
        sortable: true,
        sortKey: "quantity",
        render: (r) => toNumber(r.quantity),
      },
      {
        key: "reserved",
        header: "Reservado",
        render: (r) => toNumber(r.reservedQuantity),
      },
      {
        key: "available",
        header: "Disponible",
        sortable: true,
        sortKey: "availableQuantity",
        render: (r) => toNumber(r.availableQuantity),
      },
      {
        key: "min",
        header: "Minimo",
        render: (r) => toNumber(r.item?.minimumStock),
      },
      {
        key: "movs",
        header: "Movimientos",
        render: (r) => (
          <Link
            href={`/inventario/movimientos?itemId=${r.itemId}&warehouseId=${r.warehouseId}`}
            className="text-sm text-brand-700 hover:underline"
          >
            Ver
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Existencias"
        description="Stock por item y almacen. Los cambios solo ocurren via movimientos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can permission="inventory.create_entry">
              <Button as={Link} href="/inventario/movimientos/entrada">
                <Plus className="h-4 w-4" /> Entrada
              </Button>
            </Can>
            <Can permission="inventory.create_exit">
              <Button
                as={Link}
                href="/inventario/movimientos/salida"
                variant="secondary"
              >
                <ArrowUpFromLine className="h-4 w-4" /> Salida
              </Button>
            </Can>
            <Can permission="inventory.adjust">
              <Button
                as={Link}
                href="/inventario/movimientos/ajuste"
                variant="secondary"
              >
                <SlidersHorizontal className="h-4 w-4" /> Ajuste
              </Button>
            </Can>
          </div>
        }
      />

      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar por SKU o nombre..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.itemType ?? ""}
          onChange={(e) => list.setFilter("itemType", e.target.value)}
          className="w-44"
        >
          <option value="">Todos los tipos</option>
          <option value="PRODUCT">Producto</option>
          <option value="RAW_MATERIAL">Materia prima</option>
          <option value="CONSUMABLE">Consumible</option>
          <option value="TOOL">Herramienta</option>
          <option value="EQUIPMENT">Equipo</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            checked={list.filters.lowStock === "1"}
            onChange={(e) =>
              list.setFilter("lowStock", e.target.checked ? "1" : "")
            }
          />
          Solo stock bajo
        </label>
      </TableToolbar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        sort={list.sort}
        onSort={list.toggleSort}
        emptyTitle="Sin existencias"
        emptyDescription="Registra una entrada de inventario para comenzar."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
