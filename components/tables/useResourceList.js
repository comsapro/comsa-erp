"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, toQuery } from "@/lib/api/client";

// Hook que administra el estado de un listado: busqueda, filtros, orden,
// paginacion, carga y errores. Consume un endpoint que devuelve
// { data, pagination }.
export function useResourceList(endpoint, options = {}) {
  const {
    initialSort = "createdAt",
    initialOrder = "desc",
    pageSize: pageSizeOption = 10,
    initialFilters = {},
  } = options;

  const pageSize = pageSizeOption;

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ field: initialSort, order: initialOrder });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debounceRef = useRef(null);
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    const query = toQuery({
      q: debouncedQ,
      page,
      pageSize,
      sort: sort.field,
      order: sort.order,
      ...filters,
    });

    api
      .get(`${endpoint}${query}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res?.data || []);
        if (res?.pagination) setPagination(res.pagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "No se pudo cargar la informacion.");
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, debouncedQ, page, pageSize, sort, filters, reloadToken]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, order: "asc" };
      return { field, order: prev.order === "asc" ? "desc" : "asc" };
    });
  }, []);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    rows,
    pagination,
    loading,
    error,
    q,
    setQ,
    filters,
    setFilter,
    sort,
    toggleSort,
    page,
    setPage,
    refresh,
  };
}
