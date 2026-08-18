"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Can } from "@/components/permissions/Can";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
  PRODUCTION_SOURCE_LABELS,
  PRODUCTION_PRIORITY_LABELS,
  PRODUCTION_PRIORITY_TONES,
} from "@/domains/production/constants";
import { itemHoursSummary } from "@/domains/production/process-rules";
import { HoursBar } from "@/components/production/HoursBar";
import { ProductionItemWorkspace } from "@/components/production/ProductionItemWorkspace";

const EMPTY_INCIDENT = {
  title: "",
  description: "",
  type: "OTHER",
  blocking: false,
};
const EMPTY_EXTRA = { description: "", quantity: "", unit: "", reason: "" };

export default function ProductionDetailClient({ id }) {
  const { toast } = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState({});
  const [reopenItem, setReopenItem] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [assignables, setAssignables] = useState([]);
  const [handicap, setHandicap] = useState(0);
  const [incidentDraft, setIncidentDraft] = useState(EMPTY_INCIDENT);
  const [extraDraft, setExtraDraft] = useState(EMPTY_EXTRA);

  const applyUpdated = useCallback((updated) => {
    if (!updated?.id) return;
    setRecord(updated);
    const drafts = {};
    for (const item of updated.items || []) {
      drafts[item.id] = {
        completedQuantity: Number(item.completedQuantity) || 0,
        observations: item.observations || "",
      };
    }
    setProgressDraft(drafts);
    setSelectedId((curr) => {
      if (curr && (updated.items || []).some((i) => i.id === curr)) return curr;
      return updated.items?.[0]?.id || null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, users, settings] = await Promise.all([
        api.get(`/api/produccion/${id}`),
        api.get("/api/produccion/asignables").catch(() => []),
        api.get("/api/produccion/config").catch(() => ({ handicapPercent: 0 })),
      ]);
      applyUpdated(data);
      setAssignables(Array.isArray(users) ? users : users?.data || []);
      setHandicap(Number(settings?.handicapPercent) || 0);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [id, applyUpdated]);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (err, title = "No se pudo completar") => {
    toast({ variant: "error", title, description: err.message });
  };

  const runOrderAction = async (action, body) => {
    setActing(true);
    try {
      const updated = await api.post(`/api/produccion/${id}/acciones/${action}`, body);
      applyUpdated(updated);
      toast({ variant: "success", title: "Accion aplicada" });
    } catch (err) {
      fail(err);
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
      applyUpdated(updated);
      toast({ variant: "success", title: "Partida actualizada" });
    } catch (err) {
      fail(err);
    } finally {
      setActing(false);
    }
  };

  const runProcessChange = async (itemId, type, processId, payload) => {
    setActing(true);
    try {
      const base = `/api/produccion/${id}/items/${itemId}/procesos`;
      let updated;
      if (type === "add-process") updated = await api.post(base, payload);
      else if (type === "hours") updated = await api.patch(`${base}/${processId}`, payload);
      else if (type === "complete-process") {
        updated = await api.post(`${base}/${processId}/acciones/completar`);
      } else if (type === "replace-process") {
        updated = await api.post(`${base}/${processId}/acciones/reemplazar`, payload);
      } else if (type === "delete-process") updated = await api.del(`${base}/${processId}`);
      else if (type === "session-start") {
        updated = await api.post(`${base}/${processId}/acciones/iniciar-sesion`);
      } else if (type === "session-pause") {
        updated = await api.post(`${base}/${processId}/acciones/pausar`);
      } else if (type === "session-resume") {
        updated = await api.post(`${base}/${processId}/acciones/reanudar`);
      } else if (type === "session-end") {
        updated = await api.post(`${base}/${processId}/acciones/finalizar-sesion`);
      } else if (type === "assign-process") {
        updated = await api.post(`${base}/${processId}/acciones/asignar`, payload);
      }
      applyUpdated(updated);
      toast({ variant: "success", title: "Proceso actualizado" });
    } catch (err) {
      fail(err, "No se pudo actualizar el proceso");
    } finally {
      setActing(false);
    }
  };

  const createIncident = async (itemId) => {
    setActing(true);
    try {
      const updated = await api.post(`/api/produccion/${id}/incidencias`, {
        ...incidentDraft,
        productionItemId: itemId,
      });
      applyUpdated(updated);
      setIncidentDraft(EMPTY_INCIDENT);
      toast({ variant: "success", title: "Incidencia registrada" });
    } catch (err) {
      fail(err);
    } finally {
      setActing(false);
    }
  };

  const updateIncidentStatus = async (incidentId, status) => {
    setActing(true);
    try {
      const updated = await api.patch(
        `/api/produccion/${id}/incidencias/${incidentId}`,
        { status }
      );
      applyUpdated(updated);
    } catch (err) {
      fail(err);
    } finally {
      setActing(false);
    }
  };

  const saveExtraMaterial = async (itemId) => {
    setActing(true);
    try {
      const updated = await api.post(`/api/produccion/${id}/materiales-extra`, {
        ...extraDraft,
        productionItemId: itemId,
        quantity: Number(extraDraft.quantity),
      });
      applyUpdated(updated);
      setExtraDraft(EMPTY_EXTRA);
      toast({ variant: "success", title: "Material adicional registrado" });
    } catch (err) {
      fail(err);
    } finally {
      setActing(false);
    }
  };

  const savePlanning = async (itemId, payload) => {
    setActing(true);
    try {
      const updated = await api.patch(`/api/produccion/${id}/items/${itemId}`, payload);
      applyUpdated(updated);
      toast({ variant: "success", title: "Planeacion guardada" });
    } catch (err) {
      fail(err);
    } finally {
      setActing(false);
    }
  };

  const selected = useMemo(
    () => (record?.items || []).find((i) => i.id === selectedId) || null,
    [record, selectedId]
  );

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

  const sourceLabel =
    record.sourceType === "QUOTE"
      ? record.quote?.folio
      : record.directOrder?.folio;
  const isOpen = record.status === "PENDING" || record.status === "IN_PROGRESS";
  const ocHref = record.quote?.id
    ? `/ordenes-compra/nuevo?productionOrderId=${id}&quoteId=${record.quote.id}`
    : `/ordenes-compra/nuevo?productionOrderId=${id}`;
  const allHours = itemHoursSummary(
    (record.items || []).flatMap((i) => i.processes || [])
  );
  const openIncidents = (record.incidents || []).length;
  const quoteDocs = record.quoteDocumentation?.attachments || [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Produccion ${record.folio}`}
        description={`${record.client?.commercialName || ""} · ${PRODUCTION_SOURCE_LABELS[record.sourceType] || record.sourceType}${sourceLabel ? ` ${sourceLabel}` : ""}`}
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
              <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
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
            PDF / QR de piso
          </Button>
        </Can>
        <Can permission="production.manage_handicap">
          <span className="text-xs text-content-muted">Handicap {handicap}%</span>
        </Can>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-content-muted">Avance</p>
          <p className="mt-1 text-2xl font-semibold">{Number(record.progressPercentage)}%</p>
          <p className="text-xs text-content-muted">
            {record.completedItems}/{record.totalItems} partidas
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Horas</p>
          <HoursBar
            quotedHours={allHours.quotedHours}
            expectedHours={allHours.expectedHours}
            realHours={allHours.realHours}
          />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Material</p>
          <p className="mt-1 text-base font-medium">
            {record.materialsReadyAt ? "Listo para fabricar" : "Pendiente"}
          </p>
          {record.startedAt && (
            <p className="text-xs text-content-muted">
              Inicio {formatDateTime(record.startedAt)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-content-muted">Incidencias abiertas</p>
          <p className="mt-1 text-2xl font-semibold">{openIncidents}</p>
          <p className="text-xs text-content-muted">{formatDate(record.approvalDate)}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Partidas</h2>
          </div>
          <ul className="divide-y divide-border">
            {(record.items || []).map((item) => {
              const hours = itemHoursSummary(item.processes || []);
              const blocking = (item.incidents || []).some(
                (i) => i.blocking && ["OPEN", "IN_REVIEW"].includes(i.status)
              );
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selectedId === item.id ? "bg-brand-50" : "hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        #{item.position} {item.description}
                      </p>
                      <Badge tone={PRODUCTION_STATUS_TONES[item.status] || "neutral"}>
                        {PRODUCTION_STATUS_LABELS[item.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-content-muted">
                      {Number(item.completedQuantity)}/{Number(item.quantity)}
                      {item.assignedToUser?.name ? ` · ${item.assignedToUser.name}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        tone={PRODUCTION_PRIORITY_TONES[item.priority] || "neutral"}
                      >
                        {PRODUCTION_PRIORITY_LABELS[item.priority] || "Normal"}
                      </Badge>
                      {blocking ? (
                        <span className="text-[11px] font-medium text-danger-700">
                          Incidencia
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <HoursBar
                        compact
                        quotedHours={hours.quotedHours}
                        expectedHours={hours.expectedHours}
                        realHours={hours.realHours}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          {!selected ? (
            <p className="p-6 text-sm text-content-muted">Selecciona una partida.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold">
                    #{selected.position} · {selected.description}
                  </h2>
                  {selected.completedByUser && (
                    <p className="text-xs text-content-muted">
                      Completado por {selected.completedByUser.name}
                    </p>
                  )}
                </div>
                {selected.status === "COMPLETED" && (
                  <Can permission="production.reopen_item">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReopenItem(selected);
                        setReopenReason("");
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Reabrir
                    </Button>
                  </Can>
                )}
              </div>
              <ProductionItemWorkspace
                productionId={id}
                record={record}
                item={selected}
                assignables={assignables}
                quoteDocs={quoteDocs}
                acting={acting}
                canProgress={
                  (isOpen || record.status === "COMPLETED") &&
                  selected.status !== "COMPLETED" &&
                  selected.status !== "CANCELLED"
                }
                canManageProcesses={
                  record.status !== "CANCELLED" &&
                  selected.status !== "COMPLETED" &&
                  selected.status !== "CANCELLED"
                }
                progressDraft={
                  progressDraft[selected.id] || {
                    completedQuantity: 0,
                    observations: "",
                  }
                }
                setProgressDraft={setProgressDraft}
                runItemAction={runItemAction}
                runProcessChange={runProcessChange}
                onRecordChange={applyUpdated}
                incidentDraft={incidentDraft}
                setIncidentDraft={setIncidentDraft}
                createIncident={createIncident}
                updateIncidentStatus={updateIncidentStatus}
                extraDraft={extraDraft}
                setExtraDraft={setExtraDraft}
                saveExtraMaterial={saveExtraMaterial}
                savePlanning={savePlanning}
              />
            </>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Compras e inventario</h2>
          <div className="flex flex-wrap gap-2">
            <Can permission="purchase_orders.create">
              <Button as={Link} href={ocHref} size="sm" variant="secondary">
                Crear OC
              </Button>
            </Can>
            <Can permission="inventory.create_exit">
              <Button
                as={Link}
                href="/inventario/movimientos/salida"
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

      <Modal
        open={Boolean(reopenItem)}
        onClose={() => setReopenItem(null)}
        title="Reabrir partida"
        description="El item pasara a retrabajo. El historial de terminado se conserva."
      >
        <Textarea
          rows={4}
          placeholder="Motivo obligatorio"
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReopenItem(null)}>
            Cancelar
          </Button>
          <Button
            loading={acting}
            onClick={async () => {
              if (!reopenItem) return;
              await runItemAction(reopenItem.id, "reopen", { reason: reopenReason });
              setReopenItem(null);
            }}
          >
            Reabrir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ProductionInventoryPanel({ productionId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get(`/api/produccion/${productionId}/inventario`)
      .then(setData)
      .catch(() =>
        setData({ purchaseOrders: [], movements: [], consumedMaterials: [] })
      );
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
