"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { formatDate } from "@/lib/utils/format";

export default function ReceiptsClient() {
  const list = useResourceList("/api/recepciones", {
    initialSort: "receiptDate",
  });

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        render: (r) => (
          <Link
            href={`/recepciones/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "po",
        header: "OC",
        render: (r) => (
          <Link
            href={`/ordenes-compra/${r.purchaseOrderId}`}
            className="text-brand-700 hover:underline"
          >
            {r.purchaseOrder?.folio}
          </Link>
        ),
      },
      {
        key: "supplier",
        header: "Proveedor",
        render: (r) => r.supplier?.name,
      },
      {
        key: "wh",
        header: "Almacen",
        render: (r) => r.warehouse?.name,
      },
      {
        key: "date",
        header: "Fecha",
        render: (r) => formatDate(r.receiptDate),
      },
      {
        key: "user",
        header: "Recibido por",
        render: (r) => r.receivedByUser?.name,
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Recepciones de compra"
        description="Historial de recepciones contra ordenes de compra."
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar folio..."
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
        emptyTitle="Sin recepciones"
        emptyDescription="Las recepciones aparecen al recibir una OC."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
