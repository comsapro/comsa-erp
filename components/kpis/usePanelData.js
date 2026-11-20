"use client";

import { useCallback, useEffect, useState } from "react";
import { api, toQuery } from "@/lib/api/client";

/** Carga un endpoint KPI con los parametros del periodo y reintenta al cambiar. */
export function usePanelData(url, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = toQuery(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get(`${url}${query}`));
    } catch (err) {
      setError(err.message || "No se pudo cargar el indicador");
    } finally {
      setLoading(false);
    }
  }, [url, query]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
