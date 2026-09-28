"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
} from "@/domains/production/constants";
import {
  QUALITY_STATUS,
  QUALITY_STATUS_LABELS,
  QUALITY_STATUS_TONES,
} from "@/domains/quality/drawing-constants";

const QUALITY_STATUS_FILTERS = Object.values(QUALITY_STATUS);

export default function QualityInspectionsClient() {
  const list = useResourceList("/api/calidad/partidas", {
    initialSort: "createdAt",
    initialFilters: { qualityStatus: "" },
  });

  const columns = useMemo(
    () => [
      {
        key: "production",
        header: "Produccion",
        render: (r) => (
          <Link
            href={`/calidad/partida/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.productionOrder?.folio || "—"}
          </Link>
        ),
      },
      {
        key: "item",
        header: "Partida",
        sortable: true,
        sortKey: "position",
        render: (r) => (
          <Link
            href={`/calidad/partida/${r.id}`}
            className="text-content hover:underline"
          >
            #{r.position} {r.description || "Sin descripcion"}
          </Link>
        ),
      },
      {
        key: "client",
        header: "Cliente",
        render: (r) => r.clientName || "—",
      },
      {
        key: "drawings",
        header: "Planos",
        render: (r) => {
          if (!r.pdfCount) {
            return <span className="text-content-muted">Sin PDF</span>;
          }
          const names = r.drawingNames || [];
          const preview = names.slice(0, 2).join(", ");
          const extra = names.length > 2 ? ` +${names.length - 2}` : "";
          return (
            <span title={names.join(", ")}>
              {r.pdfCount} {r.pdfCount === 1 ? "PDF" : "PDFs"}
              {preview ? ` · ${preview}${extra}` : ""}
            </span>
          );
        },
      },
      {
        key: "itemStatus",
        header: "Estatus",
        render: (r) => (
          <Badge tone={PRODUCTION_STATUS_TONES[r.status] || "neutral"}>
            {PRODUCTION_STATUS_LABELS[r.status] || r.status}
          </Badge>
        ),
      },
      {
        key: "qualityStatus",
        header: "Calidad",
        render: (r) => (
          <Badge tone={QUALITY_STATUS_TONES[r.qualityStatus] || "neutral"}>
            {QUALITY_STATUS_LABELS[r.qualityStatus] || r.qualityStatus}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Calidad"
        description="Partidas en produccion. Anota y mide sobre los PDFs subidos en evidencias."
      />
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar orden, partida o cliente..."
        onRefresh={list.refresh}
        loading={list.loading}
      >
        <Select
          value={list.filters.qualityStatus || ""}
          onChange={(e) => list.setFilter("qualityStatus", e.target.value)}
          className="w-52"
        >
          <option value="">Todos los estatus</option>
          {QUALITY_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {QUALITY_STATUS_LABELS[status]}
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
        emptyTitle="Sin partidas en produccion"
        emptyDescription="Cuando existan ordenes de produccion activas, las partidas apareceran aqui."
      />
      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
}
