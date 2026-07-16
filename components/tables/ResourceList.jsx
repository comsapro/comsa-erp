"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useResourceList } from "./useResourceList";
import { DataTable } from "./DataTable";
import { TableToolbar } from "./TableToolbar";
import { Pagination } from "./Pagination";

// Componente compuesto: toolbar (busqueda + filtros) + tabla + paginacion.
// Expone refresh() via ref para recargar tras crear/editar/eliminar.
export const ResourceList = forwardRef(function ResourceList(
  {
    endpoint,
    columns,
    searchPlaceholder,
    filters = [],
    initialSort = "createdAt",
    initialOrder = "desc",
    pageSize = 10,
    emptyTitle = "Sin resultados",
    emptyDescription = "No se encontraron registros con los criterios actuales.",
    emptyAction,
    toolbarRight,
    rowKey,
  },
  ref
) {
  const initialFilters = {};
  for (const f of filters) {
    if (f.defaultValue !== undefined) initialFilters[f.key] = f.defaultValue;
  }

  const list = useResourceList(endpoint, {
    initialSort,
    initialOrder,
    pageSize,
    initialFilters,
  });

  useImperativeHandle(ref, () => ({ refresh: list.refresh }), [list.refresh]);

  const toolbarFilters = filters.map((f) => ({
    key: f.key,
    label: f.label,
    options: f.options,
    value: list.filters[f.key] ?? "",
    onChange: (value) => list.setFilter(f.key, value),
  }));

  return (
    <div>
      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder={searchPlaceholder}
        filters={toolbarFilters}
        onRefresh={list.refresh}
        loading={list.loading}
      >
        {toolbarRight}
      </TableToolbar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        sort={list.sort}
        onSort={list.toggleSort}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        rowKey={rowKey}
      />

      <Pagination
        pagination={list.pagination}
        onPageChange={list.setPage}
        loading={list.loading}
      />
    </div>
  );
});

export default ResourceList;
