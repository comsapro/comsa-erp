"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Can } from "@/components/permissions/Can";
import { formatDateTime } from "@/lib/utils/format";
import { PRODUCTION_ACTIVITY_LABELS } from "@/domains/production/constants";

const FILTERS = [
  { id: "ALL", label: "Todo" },
  { id: "TIMES", label: "Tiempos" },
  { id: "COMMENTS", label: "Comentarios" },
  { id: "INCIDENTS", label: "Incidencias" },
  { id: "PHOTOS", label: "Fotos" },
];

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

export function ProductionActivityFeed({
  productionId,
  itemId,
  onSubmitted,
}) {
  const [filter, setFilter] = useState("ALL");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    if (itemId) qs.set("itemId", itemId);
    if (filter !== "ALL") qs.set("filter", filter);
    api
      .get(`/api/produccion/${productionId}/actividad?${qs.toString()}`)
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productionId, itemId, filter]);

  const submit = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const updated = await api.post(`/api/produccion/${productionId}/actividad`, {
        body: body.trim(),
        productionItemId: itemId,
      });
      setBody("");
      onSubmitted?.(updated);
      const qs = new URLSearchParams();
      if (itemId) qs.set("itemId", itemId);
      const data = await api.get(
        `/api/produccion/${productionId}/actividad?${qs.toString()}`
      );
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[320px] flex-col">
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.id
                ? "bg-brand-600 text-white"
                : "bg-surface-muted text-content-muted hover:text-content"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-content-muted">Cargando bitacora...</p>
        ) : !rows.length ? (
          <p className="text-sm text-content-muted">
            Aun no hay eventos en esta partida.
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-md border border-border px-3 py-2"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                {PRODUCTION_ACTIVITY_LABELS[row.type] || row.type} ·{" "}
                {formatDateTime(row.createdAt)} · {row.createdByUser?.name || "Sistema"}
              </p>
              {row.body ? (
                <p className="mt-1 text-sm text-content">{row.body}</p>
              ) : null}
              {(row.attachments || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={blobUrl(file.pathname)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      {file.fileName}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
      <Can permission="production.update_progress">
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <Textarea
            rows={2}
            placeholder="Comentario de piso..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" loading={sending} onClick={submit}>
              Registrar comentario
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}

