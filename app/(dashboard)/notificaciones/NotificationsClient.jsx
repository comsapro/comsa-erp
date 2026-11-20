"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import { INCIDENT_PRIORITY_LABELS, INCIDENT_PRIORITY_TONES } from "@/domains/kpis/constants";
import { cn } from "@/lib/utils/cn";

export default function NotificationsClient() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/notificaciones${toQuery({ unread: unreadOnly ? "1" : undefined, take: 100 })}`);
      setRows(res?.data || []);
      setUnread(res?.unread || 0);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  async function open(n) {
    if (!n.readAt) await api.post(`/api/notificaciones/${n.id}/leer`).catch(() => {});
    if (n.link) router.push(n.link);
    else load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notificaciones"
        description="Avisos internos del ERP. El envío por correo se habilitará cuando se configure el servicio de correo."
        actions={
          unread > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api.post("/api/notificaciones/leer-todas");
                load();
              }}
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como leídas
            </Button>
          ) : null
        }
      />
      <div className="flex gap-2">
        <Button size="sm" variant={!unreadOnly ? "primary" : "secondary"} onClick={() => setUnreadOnly(false)}>
          Todas
        </Button>
        <Button size="sm" variant={unreadOnly ? "primary" : "secondary"} onClick={() => setUnreadOnly(true)}>
          Sin leer {unread > 0 && <Badge tone="danger">{unread}</Badge>}
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Bell} title="Sin notificaciones" />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-surface-muted/60", !n.readAt && "bg-brand-50/40")}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={INCIDENT_PRIORITY_TONES[n.priority]}>{INCIDENT_PRIORITY_LABELS[n.priority]}</Badge>
                    <span className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}</span>
                  </span>
                  {n.body && <span className="whitespace-pre-line text-sm text-content-muted">{n.body}</span>}
                  <span className="text-xs text-content-muted">
                    {formatDateTime(n.createdAt)}
                    {n.readAt ? ` · Leída ${formatDateTime(n.readAt)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
