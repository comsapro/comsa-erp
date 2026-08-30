"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Pause, Play, Square } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Can } from "@/components/permissions/Can";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
} from "@/domains/production/constants";
import { formatDateTime } from "@/lib/utils/format";

const ACTION_LABELS = {
  start: "Iniciar tiempo",
  pause: "Pausar",
  resume: "Reanudar",
  end: "Terminar tiempo",
};

export default function ProductionScanClient({ orderId, itemId }) {
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/produccion/${orderId}/items/${itemId}/escaneo`);
      setCtx(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la partida");
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action) => {
    setActing(true);
    try {
      await api.post(`/api/produccion/${orderId}/items/${itemId}/escaneo`, { action });
      await load();
      toast({
        variant: "success",
        title: ACTION_LABELS[action] || "Accion aplicada",
      });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo registrar",
        description: err.message,
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <Alert variant="danger" title="Error">
          {error || "Partida no encontrada"}
        </Alert>
        <Button as={Link} href={`/produccion/${orderId}`} variant="secondary">
          <ArrowLeft className="h-4 w-4" /> Volver a la orden
        </Button>
      </div>
    );
  }

  const suggested = ctx.suggestedAction;
  const sessionStatus = ctx.session?.status;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-10">
      <PageHeader
        title="Escaneo de partida"
        description={`${ctx.order.folio} · #${ctx.item.position}`}
        actions={
          <Button as={Link} href={`/produccion/${orderId}`} variant="subtle" size="sm">
            <ArrowLeft className="h-4 w-4" /> Orden
          </Button>
        }
      />

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{ctx.item.description}</p>
            <p className="text-sm text-content-muted">
              {ctx.order.clientName || "Cliente"} · {ctx.item.completedQuantity}/
              {ctx.item.quantity} pz
            </p>
          </div>
          <Badge tone={PRODUCTION_STATUS_TONES[ctx.item.status] || "neutral"}>
            {PRODUCTION_STATUS_LABELS[ctx.item.status] || ctx.item.status}
          </Badge>
        </div>

        {ctx.process ? (
          <div className="rounded-md border border-border bg-surface-muted/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
              Etapa actual
            </p>
            <p className="mt-1 text-base font-semibold text-brand-800">{ctx.process.name}</p>
            {ctx.session ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-content-muted">
                <Clock className="h-4 w-4" />
                Sesion {sessionStatus === "RUNNING" ? "en curso" : "pausada"}
                {ctx.session.startedAt
                  ? ` · desde ${formatDateTime(ctx.session.startedAt)}`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-content-muted">Sin sesion abierta</p>
            )}
          </div>
        ) : (
          <Alert variant="warning" title="Sin proceso pendiente">
            Esta partida no tiene una etapa pendiente para registrar tiempos.
          </Alert>
        )}
      </Card>

      <Can
        permission="production.record_sessions"
        fallback={
          <Alert variant="warning" title="Sin permiso">
            Tu usuario no puede registrar sesiones de tiempo. Solicita el permiso a un
            administrador.
          </Alert>
        }
      >
        {ctx.process ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">Control de tiempo</p>
            {!ctx.session && suggested === "start" ? (
              <Button
                size="lg"
                className="w-full"
                loading={acting}
                onClick={() => runAction("start")}
              >
                <Play className="h-5 w-5" /> Iniciar tiempo
              </Button>
            ) : null}
            {sessionStatus === "RUNNING" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  loading={acting}
                  onClick={() => runAction("pause")}
                >
                  <Pause className="h-5 w-5" /> Pausar
                </Button>
                <Button
                  size="lg"
                  className="w-full"
                  loading={acting}
                  onClick={() => runAction("end")}
                >
                  <Square className="h-5 w-5" /> Terminar tiempo
                </Button>
              </div>
            ) : null}
            {sessionStatus === "PAUSED" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  loading={acting}
                  onClick={() => runAction("resume")}
                >
                  <Play className="h-5 w-5" /> Reanudar
                </Button>
                <Button
                  size="lg"
                  className="w-full"
                  loading={acting}
                  onClick={() => runAction("end")}
                >
                  <Square className="h-5 w-5" /> Terminar tiempo
                </Button>
              </div>
            ) : null}
            {!ctx.session && suggested !== "start" ? (
              <Button
                size="lg"
                className="w-full"
                loading={acting}
                onClick={() => runAction(suggested || "start")}
              >
                Registrar tiempo
              </Button>
            ) : null}
          </Card>
        ) : null}
      </Can>
    </div>
  );
}
