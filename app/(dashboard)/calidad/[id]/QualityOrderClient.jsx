"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  QUALITY_INSPECTION_MODE_LABELS,
  QUALITY_ITEM_STATUS_LABELS,
  QUALITY_PIECE_STATUS_LABELS,
  QUALITY_RESULT_LABELS,
  QUALITY_SPECIAL_CHECK_TYPE_LABELS,
  piecesForReview,
} from "@/domains/quality/constants";
import { StartInspectionModal } from "@/components/quality/StartInspectionModal";
import { ReworkOrderModal } from "@/components/quality/ReworkOrderModal";

export default function QualityOrderClient({ orderId }) {
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [inspectModal, setInspectModal] = useState({
    open: false,
    itemId: null,
    piece: null,
    type: "PIECE",
  });
  const [reworkModal, setReworkModal] = useState({
    open: false,
    item: null,
    piece: null,
  });
  const [missingProcessModal, setMissingProcessModal] = useState({
    open: false,
    item: null,
    inspectionId: null,
  });
  const [processCatalog, setProcessCatalog] = useState([]);
  const [selectedMissingProcessIds, setSelectedMissingProcessIds] = useState([]);
  const [missingProcessNotes, setMissingProcessNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/calidad/ordenes/${orderId}`);
      setOrder(data);
      const next = {};
      for (const item of data.items || []) {
        next[item.id] = {
          fabricatedQty: item.qualityConfig?.fabricatedQty ?? item.quantity,
          inspectionMode: item.qualityConfig?.inspectionMode || "FULL",
          sampleEveryN: item.qualityConfig?.sampleEveryN || 5,
          requiresFirstPiece: item.qualityConfig?.requiresFirstPiece || false,
        };
      }
      setDrafts(next);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(itemId, action, body, successTitle = "Actualizado") {
    setBusy(true);
    try {
      await api.post(`/api/calidad/partidas/${itemId}?action=${action}`, body);
      toast({ variant: "success", title: successTitle });
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  /** Guarda la modalidad del borrador y luego genera piezas, para no perder el N. */
  async function generatePiecesWithDraft(itemId) {
    const draft = drafts[itemId] || {};
    setBusy(true);
    try {
      await api.post(`/api/calidad/partidas/${itemId}?action=sampling`, {
        inspectionMode: draft.inspectionMode || "FULL",
        sampleEveryN:
          draft.inspectionMode === "SAMPLE"
            ? Number(draft.sampleEveryN) || null
            : null,
        requiresFirstPiece: Boolean(draft.requiresFirstPiece),
      });
      await api.post(`/api/calidad/partidas/${itemId}?action=pieces`, {});
      toast({ variant: "success", title: "Piezas generadas" });
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function closeInspection(inspection, result) {
    setBusy(true);
    try {
      await api.post(`/api/calidad/inspecciones/${inspection.id}/cerrar`, {
        result,
        measurements: [],
        specialChecks: (inspection.specialChecks || [])
          .filter((check) => check.required && check.result === "PENDING")
          .map((check) => ({
            id: check.id,
            checkType: check.checkType,
            required: check.required,
            result,
          })),
      });
      toast({ variant: "success", title: "Inspeccion cerrada" });
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  function openRework(item, piece) {
    setReworkModal({ open: true, item, piece });
  }

  async function openMissingProcessRequest(item, inspection) {
    setBusy(true);
    try {
      const result = await api.get("/api/produccion/procesos-catalogo");
      setProcessCatalog(Array.isArray(result) ? result : result?.data || []);
      setSelectedMissingProcessIds([]);
      setMissingProcessNotes("");
      setMissingProcessModal({
        open: true,
        item,
        inspectionId: inspection.id,
      });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudieron cargar los procesos",
        description: err.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitMissingProcessRequest() {
    const item = missingProcessModal.item;
    if (!item || !missingProcessModal.inspectionId) return;
    if (!selectedMissingProcessIds.length) {
      toast({
        variant: "error",
        title: "Selecciona al menos un proceso faltante",
      });
      return;
    }
    setBusy(true);
    try {
      const result = await api.post("/api/calidad/ncr?action=missing-process", {
        qualityInspectionId: missingProcessModal.inspectionId,
        productionItemId: item.id,
        manufacturingProcessIds: selectedMissingProcessIds,
        notes: missingProcessNotes || null,
      });
      toast({
        variant: "success",
        title: "Procesos solicitados a Produccion",
        description: `${result.processes.length} proceso(s) agregado(s). Se creo una alerta interna; el correo esta pendiente de configurar.`,
      });
      setMissingProcessModal({ open: false, item: null, inspectionId: null });
      await load();
    } catch (err) {
      toast({ variant: "error", title: "No se pudo solicitar el proceso", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function submitRework({ cause, instructions, processes }) {
    const item = reworkModal.item;
    const piece = reworkModal.piece;
    if (!item || !piece) return;
    setBusy(true);
    try {
      const created = await api.post("/api/calidad/retrabajos", {
        productionItemId: item.id,
        qualityPieceIds: [piece.id],
        cause,
        instructions,
        processes,
      });
      toast({
        variant: "success",
        title: "Orden de retrabajo creada",
        description: created?.folio
          ? `${created.folio} · notificado a Produccion`
          : "Notificado a Produccion",
      });
      setReworkModal({ open: false, item: null, piece: null });
      if (created?.id) {
        window.open(`/api/calidad/retrabajos/${created.id}/pdf`, "_blank");
      }
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function sharePiece(pieceId) {
    setBusy(true);
    try {
      const share = await api.post("/api/calidad/shares", {
        qualityPieceId: pieceId,
        productionOrderId: orderId,
        showEvidences: true,
      });
      const url = `${window.location.origin}${share.path}`;
      await navigator.clipboard?.writeText(url);
      toast({ variant: "success", title: "QR externo generado", description: url });
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!order) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Calidad · ${order.folio}`}
        description={`${order.client?.commercialName || ""}${
          order.quote?.folio ? ` · Cotizacion ${order.quote.folio}` : ""
        }`}
        actions={
          <div className="flex gap-2">
            <Button as={Link} href="/calidad" variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Bandeja
            </Button>
            <Button as={Link} href={`/calidad/historial/${orderId}`} variant="secondary">
              Historial KPI
            </Button>
            <Button as={Link} href={`/produccion/${orderId}`} variant="subtle">
              Ver OP
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Acceso QR interno</h2>
          <p className="text-sm text-content-muted">
            Escanea o abre: <code className="text-xs">/calidad/{orderId}</code>
          </p>
        </CardHeader>
      </Card>

      {(order.items || []).map((item) => {
        const cfg = item.qualityConfig;
        const draft = drafts[item.id] || {};
        const pieces = cfg?.pieces || [];
        const visiblePieces = piecesForReview(pieces, cfg?.inspectionMode || "FULL");
        const inspections = cfg?.inspections || [];
        const sampleEvery = Number(cfg?.sampleEveryN) || Number(draft.sampleEveryN) || 0;
        const sampleExpected =
          cfg?.inspectionMode === "SAMPLE" && sampleEvery > 0
            ? Math.floor(Number(cfg?.fabricatedQty || item.quantity || 0) / sampleEvery)
            : null;
        return (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    Partida {item.position} — {item.description}
                  </h2>
                  <p className="text-sm text-content-muted">
                    Solicitada: {String(item.quantity)} · Estado:{" "}
                    {QUALITY_ITEM_STATUS_LABELS[cfg?.inspectionStatus] ||
                      "Sin config"}
                    {cfg?.requiresFirstPiece
                      ? cfg.firstPieceReleased
                        ? " · 1a pieza liberada"
                        : " · 1a pieza pendiente"
                      : ""}
                  </p>
                </div>
                <Badge>
                  {QUALITY_INSPECTION_MODE_LABELS[cfg?.inspectionMode] ||
                    "Sin modalidad"}
                </Badge>
                <Button as={Link} href={`/calidad/partida/${item.id}`} size="sm" variant="secondary">
                  Planos
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Can permission="quality.register_qty">
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1 block text-content-muted">Fabricadas</span>
                    <Input
                      type="number"
                      min="0"
                      value={draft.fabricatedQty ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.id]: { ...d[item.id], fabricatedQty: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      loading={busy}
                      onClick={() =>
                        run(item.id, "quantities", {
                          fabricatedQty: Number(draft.fabricatedQty),
                        })
                      }
                    >
                      Guardar cantidades
                    </Button>
                  </div>
                </div>
              </Can>

              <Can permission="quality.configure_sampling">
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1 block text-content-muted">Modalidad</span>
                    <Select
                      value={draft.inspectionMode}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.id]: {
                            ...d[item.id],
                            inspectionMode: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="FULL">100%</option>
                      <option value="SAMPLE">Muestreo</option>
                    </Select>
                  </label>
                  {draft.inspectionMode === "SAMPLE" && (
                    <label className="text-sm">
                      <span className="mb-1 block text-content-muted">1 de cada N</span>
                      <Input
                        type="number"
                        min="1"
                        value={draft.sampleEveryN}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [item.id]: {
                              ...d[item.id],
                              sampleEveryN: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  )}
                  <label className="flex items-end gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.requiresFirstPiece)}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.id]: {
                            ...d[item.id],
                            requiresFirstPiece: e.target.checked,
                          },
                        }))
                      }
                    />
                    Requiere 1a pieza
                  </label>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        run(item.id, "sampling", {
                          inspectionMode: draft.inspectionMode,
                          sampleEveryN:
                            draft.inspectionMode === "SAMPLE"
                              ? Number(draft.sampleEveryN)
                              : null,
                          requiresFirstPiece: Boolean(draft.requiresFirstPiece),
                        })
                      }
                    >
                      Guardar modalidad
                    </Button>
                  </div>
                </div>
              </Can>

              <div className="flex flex-wrap gap-2">
                <Can permission="quality.inspect">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy}
                    onClick={() => generatePiecesWithDraft(item.id)}
                  >
                    Generar piezas
                  </Button>
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={!visiblePieces[0]}
                    onClick={() =>
                      setInspectModal({
                        open: true,
                        itemId: item.id,
                        piece: visiblePieces[0] || null,
                        type:
                          cfg?.requiresFirstPiece && !cfg?.firstPieceReleased
                            ? "FIRST_PIECE"
                            : "PIECE",
                      })
                    }
                  >
                    Iniciar inspeccion
                  </Button>
                </Can>
              </div>

              {visiblePieces.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Piezas a revisar
                    {cfg?.inspectionMode === "SAMPLE" ? (
                      <span className="ml-2 font-normal text-content-muted">
                        · muestreo 1 de cada {sampleEvery || "N"}
                        {sampleExpected != null ? ` · ${visiblePieces.length} de ${pieces.length}` : ""}
                      </span>
                    ) : null}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {visiblePieces.map((p) => {
                      const firstPieceInspection = p.isFirstPiece
                        ? inspections.find(
                            (inspection) =>
                              inspection.type === "FIRST_PIECE" &&
                              inspection.qualityPieceId === p.id &&
                              inspection.status === "CLOSED" &&
                              inspection.result === "CONFORMING"
                          )
                        : null;
                      return (
                        <li
                          key={p.id}
                          className="rounded border border-border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{p.label}</span>
                            <Badge>
                              {QUALITY_PIECE_STATUS_LABELS[p.status] || p.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-content-muted">
                            {QUALITY_RESULT_LABELS[p.result] || p.result}
                            {p.isFirstPiece ? " · 1a pieza" : ""}
                            {p.isSample ? " · muestra" : ""}
                          </p>
                          {p.isFirstPiece && (
                            <p className="mt-1 text-xs text-content-muted">
                              Liberación:{" "}
                              {cfg?.firstPieceReleased
                                ? "Liberada"
                                : firstPieceInspection
                                  ? "Pendiente de liberar"
                                  : "Pendiente de inspección"}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.isFirstPiece &&
                              firstPieceInspection &&
                              !cfg?.firstPieceReleased && (
                                <Can permission="quality.release_first_piece">
                                  <Button
                                    size="sm"
                                    loading={busy}
                                    onClick={() =>
                                      run(
                                        item.id,
                                        "release-first-piece",
                                        {
                                          qualityPieceId: p.id,
                                          qualityInspectionId:
                                            firstPieceInspection.id,
                                        },
                                        "Primera pieza liberada"
                                      )
                                    }
                                  >
                                    Liberar primera pieza
                                  </Button>
                                </Can>
                              )}
                            <Can permission="quality.inspect">
                              {(!p.isFirstPiece ||
                                !firstPieceInspection ||
                                cfg?.firstPieceReleased) && (
                                <Button
                                  size="sm"
                                  variant="subtle"
                                  loading={busy}
                                  onClick={() =>
                                    setInspectModal({
                                      open: true,
                                      itemId: item.id,
                                      piece: p,
                                      type: p.isFirstPiece
                                        ? "FIRST_PIECE"
                                        : "PIECE",
                                    })
                                  }
                                >
                                  Inspeccionar
                                </Button>
                              )}
                            </Can>
                            <Can permission="quality.create_rework">
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={busy}
                                onClick={() => openRework(item, p)}
                              >
                                Retrabajo
                              </Button>
                            </Can>
                            <Can permission="quality.generate_external_qr">
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={busy}
                                onClick={() => sharePiece(p.id)}
                              >
                                QR externo
                              </Button>
                            </Can>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {inspections.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Inspecciones recientes</p>
                  <ul className="space-y-2">
                    {inspections.map((ins) => {
                      const pendingChecks = (ins.specialChecks || []).filter(
                        (check) => check.required && check.result === "PENDING"
                      );
                      return (
                        <li
                          key={ins.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <span>
                              {ins.type} · {ins.status} ·{" "}
                              {QUALITY_RESULT_LABELS[ins.result] || ins.result}
                              {ins.inspector?.name ? ` · ${ins.inspector.name}` : ""}
                            </span>
                            {pendingChecks.length > 0 && (
                              <p className="mt-1 text-xs text-content-muted">
                                El resultado elegido también cerrará:{" "}
                                {pendingChecks
                                  .map(
                                    (check) =>
                                      QUALITY_SPECIAL_CHECK_TYPE_LABELS[
                                        check.checkType
                                      ] || check.checkType
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                          {ins.status !== "CLOSED" && (
                            <Can permission="quality.close_inspection">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  loading={busy}
                                  onClick={() =>
                                    closeInspection(ins, "CONFORMING")
                                  }
                                >
                                  Conforme
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busy}
                                  onClick={() =>
                                    closeInspection(ins, "NON_CONFORMING")
                                  }
                                >
                                  No conforme
                                </Button>
                              </div>
                            </Can>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <Can anyOf={["quality.record_ncr", "quality.inspect", "quality.create_rework"]}>
                <div className="rounded border border-dashed border-border p-3">
                  <p className="mb-2 text-sm font-medium">Registrar NCR / proceso faltante</p>
                  <div className="flex flex-wrap gap-2">
                    <Can permission="quality.record_ncr">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={!inspections[0]}
                        onClick={async () => {
                          if (!inspections[0]) return;
                          setBusy(true);
                          try {
                            await api.post("/api/calidad/ncr", {
                              qualityInspectionId: inspections[0].id,
                              description: "No conformidad registrada desde UI",
                              area: "Calidad",
                            });
                            toast({ variant: "success", title: "NCR registrado" });
                          } catch (err) {
                            toast({
                              variant: "error",
                              title: "Error",
                              description: err.message,
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        NCR rapido
                      </Button>
                    </Can>
                    <Can permission="quality.inspect">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={!inspections[0]}
                        onClick={() =>
                          inspections[0] &&
                          openMissingProcessRequest(item, inspections[0])
                        }
                      >
                        Seleccionar procesos faltantes
                      </Button>
                    </Can>
                    <Can permission="quality.create_rework">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy}
                        disabled={!item.qualityConfig?.pieces?.[0]}
                        onClick={() => {
                          const piece = item.qualityConfig?.pieces?.[0];
                          if (piece) openRework(item, piece);
                        }}
                      >
                        Retrabajo (partida)
                      </Button>
                    </Can>
                  </div>
                </div>
              </Can>
            </CardBody>
          </Card>
        );
      })}

      <Modal
        open={missingProcessModal.open}
        onClose={() =>
          setMissingProcessModal({ open: false, item: null, inspectionId: null })
        }
        title="Solicitar procesos faltantes"
        description={
          missingProcessModal.item
            ? `Partida ${missingProcessModal.item.position} · ${missingProcessModal.item.description}`
            : ""
        }
        size="md"
      >
        <div className="space-y-4">
          {(() => {
            const existingIds = new Set(
              (missingProcessModal.item?.processes || [])
                .map((process) => process.manufacturingProcessId)
                .filter(Boolean)
            );
            const available = processCatalog.filter(
              (process) => !existingIds.has(process.id)
            );
            if (!available.length) {
              return (
                <Alert variant="info" title="No hay procesos faltantes disponibles">
                  Todos los procesos activos del catalogo ya estan asignados a esta partida.
                </Alert>
              );
            }
            return (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Selecciona uno o varios procesos
                </legend>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-border p-2">
                  {available.map((process) => (
                    <li key={process.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-surface-muted">
                        <input
                          type="checkbox"
                          checked={selectedMissingProcessIds.includes(process.id)}
                          onChange={(event) =>
                            setSelectedMissingProcessIds((current) =>
                              event.target.checked
                                ? [...current, process.id]
                                : current.filter((id) => id !== process.id)
                            )
                          }
                        />
                        <span className="font-medium">{process.name}</span>
                        <span className="text-xs text-content-muted">
                          {process.code} · {process.unit}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          })()}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notas para Produccion</span>
            <Textarea
              value={missingProcessNotes}
              onChange={(event) => setMissingProcessNotes(event.target.value)}
              rows={3}
              placeholder="Indica por que se requieren estos procesos"
            />
          </label>
          <p className="text-xs text-content-muted">
            Se agregaran a la partida y se enviara una alerta interna a Produccion.
            La notificacion por correo queda pendiente de configurar el dominio.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setMissingProcessModal({ open: false, item: null, inspectionId: null })
              }
            >
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={!selectedMissingProcessIds.length}
              onClick={submitMissingProcessRequest}
            >
              Solicitar a Produccion
            </Button>
          </div>
        </div>
      </Modal>

      <StartInspectionModal
        open={inspectModal.open}
        onClose={() =>
          setInspectModal({
            open: false,
            itemId: null,
            piece: null,
            type: "PIECE",
          })
        }
        itemId={inspectModal.itemId}
        productionOrderId={orderId}
        piece={inspectModal.piece}
        inspectionType={inspectModal.type}
        onStarted={async () => {
          toast({ variant: "success", title: "Inspeccion iniciada" });
          await load();
        }}
      />

      <ReworkOrderModal
        open={reworkModal.open}
        onClose={() =>
          setReworkModal({ open: false, item: null, piece: null })
        }
        loading={busy}
        pieceLabel={reworkModal.piece?.label || ""}
        processes={reworkModal.item?.processes || []}
        onSubmit={submitRework}
      />
    </div>
  );
}
