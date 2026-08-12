"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Can } from "@/components/permissions/Can";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
  PRODUCTION_SOURCE_LABELS,
} from "@/domains/production/constants";
import {
  ProductionDocuments,
  ProductionTemplateLinks,
} from "@/components/production/ProductionDocuments";

export default function ProductionDetailClient({ id }) {
  const { toast } = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/produccion/${id}`);
      setRecord(data);
      const drafts = {};
      for (const item of data.items || []) {
        drafts[item.id] = {
          completedQuantity: Number(item.completedQuantity) || 0,
          observations: item.observations || "",
        };
      }
      setProgressDraft(drafts);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  const runOrderAction = async (action, body) => {
    setActing(true);
    try {
      const updated = await api.post(
        `/api/produccion/${id}/acciones/${action}`,
        body
      );
      if (updated?.id) setRecord(updated);
      toast({ variant: "success", title: "Accion aplicada" });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo completar",
        description: err.message,
      });
    } finally {
      setActing(false);
      setCancelOpen(false);
    }
  };

  const runItemAction = async (itemId, action, body) => {
    setActing(true);
    try {
      const updated = await api.post(
        `/api/produccion/${id}/items/${itemId}/acciones/${action}`,
        body
      );
      setRecord(updated);
      const drafts = {};
      for (const item of updated.items || []) {
        drafts[item.id] = {
          completedQuantity: Number(item.completedQuantity) || 0,
          observations: item.observations || "",
        };
      }
      setProgressDraft(drafts);
      toast({ variant: "success", title: "Item actualizado" });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar",
        description: err.message,
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <Alert variant="danger" title="Error">
        {error || "Orden no encontrada"}
      </Alert>
    );
  }

  const sourceHref =
    record.sourceType === "QUOTE" && record.quote
      ? `/cotizaciones/${record.quote.id}`
      : record.sourceType === "DIRECT_ORDER" && record.directOrder
        ? `/ordenes-directas/${record.directOrder.id}`
        : null;
  const sourceLabel =
    record.sourceType === "QUOTE"
      ? record.quote?.folio
      : record.directOrder?.folio;
  const isOpen =
    record.status === "PENDING" || record.status === "IN_PROGRESS";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Produccion ${record.folio}`}
        description={`${record.client?.commercialName || ""} · ${PRODUCTION_SOURCE_LABELS[record.sourceType] || record.sourceType}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PRODUCTION_STATUS_TONES[record.status] || "neutral"}>
              {PRODUCTION_STATUS_LABELS[record.status] || record.status}
            </Badge>
            <Button as={Link} href="/produccion" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </div>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 p-4">
        {record.status === "PENDING" && (
          <Can permission="production.start">
            <Button size="sm" loading={acting} onClick={() => runOrderAction("start")}>
              <Play className="h-4 w-4" /> Iniciar orden
            </Button>
          </Can>
        )}
        {isOpen && (
          <>
            <Can permission="production.complete_order">
              <Button
                size="sm"
                variant="secondary"
                loading={acting}
                onClick={() => runOrderAction("complete")}
              >
                <CheckCircle2 className="h-4 w-4" /> Completar orden
              </Button>
            </Can>
            <Can permission="production.cancel">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            </Can>
            {!record.materialsReadyAt && (
              <Can permission="production.update_progress">
                <Button
                  size="sm"
                  variant="subtle"
                  loading={acting}
                  onClick={() => runOrderAction("materials-ready")}
                >
                  Marcar material listo
                </Button>
              </Can>
            )}
          </>
        )}
        <Can permission="production.print">
          <Button
            as="a"
            href={`/api/produccion/${id}/pdf`}
            size="sm"
            variant="secondary"
            target="_blank"
            rel="noreferrer"
          >
            Reimpresion hoja / PDF
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={acting}
            onClick={async () => {
              const reason = window.prompt(
                "Motivo obligatorio para nueva orden de produccion:"
              );
              if (!reason?.trim()) return;
              setActing(true);
              try {
                const created = await api.post(
                  `/api/produccion/${id}/acciones/reprint-new-order`,
                  { reason }
                );
                toast({ variant: "success", title: "Nueva OP creada" });
                if (created?.id) {
                  window.location.href = `/produccion/${created.id}`;
                }
              } catch (err) {
                toast({
                  variant: "error",
                  title: "No se pudo reimprimir",
                  description: err.message,
                });
              } finally {
                setActing(false);
              }
            }}
          >
            Reimpresion nuevo folio
          </Button>
        </Can>
        {sourceHref && (
          <Button as={Link} href={sourceHref} size="sm" variant="subtle">
            Origen {sourceLabel}
          </Button>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-content-muted">Avance</p>
          <p className="mt-1 text-2xl font-semibold">
            {Number(record.progressPercentage)}%
          </p>
          <p className="text-xs text-content-muted">
            {record.completedItems}/{record.totalItems} items
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Aprobacion</p>
          <p className="mt-1 text-base font-medium">
            {formatDate(record.approvalDate)}
          </p>
          {record.startedAt && (
            <p className="text-xs text-content-muted">
              Inicio: {formatDateTime(record.startedAt)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Cliente</p>
          <p className="mt-1 text-base font-medium">
            {record.client?.commercialName || "-"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Material</p>
          <p className="mt-1 text-base font-medium">
            {record.materialsReadyAt ? "Listo para fabricar" : "Pendiente"}
          </p>
          {record.materialsReadyAt && (
            <p className="text-xs text-content-muted">
              {formatDateTime(record.materialsReadyAt)}
              {record.materialsReadyByUser?.name
                ? ` · ${record.materialsReadyByUser.name}`
                : ""}
            </p>
          )}
        </Card>
      </div>

      <ProductionTemplateLinks />

      <ProductionDocuments
        productionId={id}
        quoteDocumentation={record.quoteDocumentation}
        initialAttachments={record.attachments || []}
        canUpload={record.status !== "CANCELLED"}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Items de produccion</h2>
        </div>
        <div className="divide-y divide-border">
          {(record.items || []).map((item) => {
            const draft = progressDraft[item.id] || {
              completedQuantity: 0,
              observations: "",
            };
            const canProgress =
              isOpen &&
              item.status !== "COMPLETED" &&
              item.status !== "CANCELLED";

            return (
              <div key={item.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-content">
                      #{item.position} · {item.description}
                    </p>
                    <p className="text-sm text-content-muted">
                      Cantidad: {Number(item.quantity)} · Completado:{" "}
                      {Number(item.completedQuantity)}
                      {item.durationMinutes != null
                        ? ` · ${item.durationMinutes} min`
                        : ""}
                    </p>
                    {(item.notes || []).length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-content-muted">
                        {item.notes.slice(0, 5).map((n) => (
                          <li key={n.id}>
                            <span className="font-medium text-content">
                              {n.createdByUser?.name || "Usuario"}
                            </span>{" "}
                            · {formatDateTime(n.createdAt)}: {n.body}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Badge tone={PRODUCTION_STATUS_TONES[item.status] || "neutral"}>
                    {PRODUCTION_STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </div>

                {canProgress && (
                  <div className="grid gap-3 rounded-[var(--radius-md)] bg-surface-muted p-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-content-muted">
                        Cant. completada
                      </label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        max={Number(item.quantity)}
                        value={draft.completedQuantity}
                        onChange={(e) =>
                          setProgressDraft((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              completedQuantity: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-content-muted">
                        Nota de bitacora
                      </label>
                      <Textarea
                        rows={2}
                        value={draft.observations}
                        onChange={(e) =>
                          setProgressDraft((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              observations: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      {item.status === "PENDING" && (
                        <Can permission="production.update_progress">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={acting}
                            onClick={() => runItemAction(item.id, "start")}
                          >
                            Iniciar
                          </Button>
                        </Can>
                      )}
                      <Can permission="production.update_progress">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={acting}
                          onClick={() =>
                            runItemAction(item.id, "update-progress", {
                              completedQuantity: Number(draft.completedQuantity),
                              observations: draft.observations,
                            })
                          }
                        >
                          Guardar avance
                        </Button>
                      </Can>
                      <Can permission="production.complete_item">
                        <Button
                          size="sm"
                          loading={acting}
                          onClick={() => runItemAction(item.id, "complete")}
                        >
                          Completar
                        </Button>
                      </Can>
                    </div>
                  </div>
                )}

                {item.completedByUser && (
                  <p className="text-xs text-content-muted">
                    Completado por {item.completedByUser.name}
                    {item.completedAt
                      ? ` · ${formatDateTime(item.completedAt)}`
                      : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Compras e inventario</h2>
          <div className="flex flex-wrap gap-2">
            <Can permission="purchase_orders.create">
              <Button
                as={Link}
                href={`/ordenes-compra/nuevo?productionOrderId=${id}`}
                size="sm"
                variant="secondary"
              >
                Crear OC
              </Button>
            </Can>
            <Can permission="inventory.create_exit">
              <Button
                as={Link}
                href={`/inventario/movimientos/salida`}
                size="sm"
                variant="secondary"
              >
                Salida a produccion
              </Button>
            </Can>
          </div>
        </div>
        <ProductionInventoryPanel productionId={id} />
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => runOrderAction("cancel")}
        title="Cancelar produccion"
        description={`Se cancelara la orden ${record.folio} y sus items pendientes.`}
        confirmLabel="Cancelar orden"
      />
    </div>
  );
}

function ProductionInventoryPanel({ productionId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get(`/api/produccion/${productionId}/inventario`)
      .then(setData)
      .catch(() => setData({ purchaseOrders: [], movements: [], consumedMaterials: [] }));
  }, [productionId]);

  if (!data) {
    return <p className="px-5 py-4 text-sm text-content-muted">Cargando...</p>;
  }

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-3">
      <div>
        <h3 className="mb-2 text-sm font-medium">Ordenes de compra</h3>
        {!data.purchaseOrders?.length ? (
          <p className="text-sm text-content-muted">Sin OC relacionadas</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.purchaseOrders.map((po) => (
              <li key={po.id}>
                <Link
                  href={`/ordenes-compra/${po.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {po.folio}
                </Link>{" "}
                · {po.supplier?.name} · {po.status}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Movimientos</h3>
        {!data.movements?.length ? (
          <p className="text-sm text-content-muted">Sin movimientos</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.movements.slice(0, 8).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/inventario/movimientos/${m.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {m.folio}
                </Link>{" "}
                · {m.movementType} · {m.item?.sku}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Materiales consumidos</h3>
        {!data.consumedMaterials?.length ? (
          <p className="text-sm text-content-muted">Sin salidas registradas</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.consumedMaterials.map((c) => (
              <li key={c.itemId}>
                {c.sku} — {c.name}: <strong>{c.quantity}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
