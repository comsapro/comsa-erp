"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { api } from "@/lib/api/client";
import { FileDropSquare } from "@/components/quality/FileDropSquare";

const STEPS = {
  KIND: "kind",
  DIMENSIONAL: "dimensional",
  ATTRIBUTE: "attribute",
};

function isPdfFile(file) {
  if (!file) return false;
  return (
    file.type === "application/pdf" || /\.pdf$/i.test(String(file.name || ""))
  );
}

function isImageFile(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(String(file.name || ""));
}

function isDrawingFile(file) {
  return isPdfFile(file) || isImageFile(file);
}

function buildDrawingOptions(docs) {
  if (!docs) return [];
  const files = (docs.candidates?.production || []).filter(
    (f) => f.isDrawing || f.isPdf || f.isImage
  );
  const fromProduction = files.map((f) => ({
    key: `attachment:${f.id}`,
    id: f.id,
    name: f.originalFilename || f.fileName || "Plano",
    kind: "attachment",
    openInspectionId: f.openInspectionId || null,
  }));
  const fromDocs = (docs.documents || []).flatMap((d) =>
    (d.versions || []).map((v) => ({
      key: `version:${v.id}`,
      id: v.id,
      name: v.originalFilename || d.originalFilename || d.title || "Plano",
      kind: "version",
      openInspectionId: null,
    }))
  );
  return [...fromProduction, ...fromDocs];
}

export function StartInspectionModal({
  open,
  onClose,
  itemId,
  productionOrderId,
  piece,
  inspectionType = "PIECE",
  onStarted,
}) {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.KIND);
  const [busy, setBusy] = useState(false);
  const [savingPlano, setSavingPlano] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState("");
  const [piecePhoto, setPiecePhoto] = useState(null);
  const [piecePreview, setPiecePreview] = useState(null);
  const [penetrantPhoto, setPenetrantPhoto] = useState(null);
  const [penetrantPreview, setPenetrantPreview] = useState(null);
  const [includeLiquidPenetrant, setIncludeLiquidPenetrant] = useState(false);
  const [observations, setObservations] = useState("");

  const loadDocs = useCallback(async () => {
    if (!itemId) return null;
    const data = await api.get(`/api/calidad/partidas/${itemId}/documentos`);
    setDocs(data);
    const options = buildDrawingOptions(data);
    if (options[0]) {
      setSelectedDrawingId((prev) => prev || options[0].key);
    }
    return data;
  }, [itemId]);

  useEffect(() => {
    if (!open) return;
    setStep(STEPS.KIND);
    setError("");
    setDocs(null);
    setSelectedDrawingId("");
    setPiecePhoto(null);
    setPiecePreview(null);
    setPenetrantPhoto(null);
    setPenetrantPreview(null);
    setIncludeLiquidPenetrant(false);
    setObservations("");
    setSavingPlano(false);
  }, [open, piece?.id]);

  useEffect(() => {
    if (!piecePhoto || isPdfFile(piecePhoto)) {
      setPiecePreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(piecePhoto);
    setPiecePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [piecePhoto]);

  useEffect(() => {
    if (!penetrantPhoto) {
      setPenetrantPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(penetrantPhoto);
    setPenetrantPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [penetrantPhoto]);

  useEffect(() => {
    if (!open || step !== STEPS.DIMENSIONAL || !itemId) return;
    let cancelled = false;
    setDocsLoading(true);
    loadDocs()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, itemId, loadDocs]);

  const drawingOptions = buildDrawingOptions(docs);

  async function uploadPhoto(file, stage = "INSPECTION") {
    const safeName = String(file.name || "pieza.jpg").replace(/[^\w.\-]+/g, "_");
    const pathname = `calidad/${productionOrderId || "op"}/${itemId}/evidencias/${Date.now()}-${safeName}`;
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: `/api/calidad/evidencias/upload?productionItemId=${encodeURIComponent(itemId)}`,
    });
    return {
      pathname: blob.pathname,
      url: blob.url || null,
      fileName: safeName,
      contentType: file.type || blob.contentType || "image/jpeg",
      sizeBytes: file.size || blob.size || 0,
      stage,
    };
  }

  async function savePlanoToPartida(file) {
    const safeName = String(file.name || "plano.pdf").replace(/[^\w.\-]+/g, "_");
    const pathname = `quality/${productionOrderId || "op"}/${itemId}/${Date.now()}-${safeName}`;
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: `/api/calidad/documentos/upload?productionItemId=${encodeURIComponent(itemId)}`,
    });
    const contentType =
      file.type ||
      (isPdfFile(file) ? "application/pdf" : "image/jpeg");
    const registered = await api.post("/api/calidad/documentos/registro", {
      productionItemId: itemId,
      pathname: blob.pathname,
      fileName: safeName,
      contentType,
      sizeBytes: file.size || blob.size || 0,
    });
    return registered;
  }

  async function openDrawingInspection(selected, notes) {
    if (selected.openInspectionId) {
      router.push(`/calidad/revision/${selected.openInspectionId}`);
      onClose?.();
      return;
    }
    await startPieceInspection({
      reviewKind: "DIMENSIONAL",
      observations: notes || null,
    });
    const body =
      selected.kind === "attachment"
        ? {
            productionItemId: itemId,
            productionAttachmentId: selected.id,
          }
        : {
            productionItemId: itemId,
            qualityDocumentVersionId: selected.id,
          };
    const created = await api.post("/api/calidad/inspecciones", body);
    onStarted?.();
    router.push(`/calidad/revision/${created.id}`);
    onClose?.();
  }

  async function handleDimensionalFile(file) {
    setError("");
    if (!file) {
      setPiecePhoto(null);
      return;
    }
    if (!isDrawingFile(file)) {
      setError("Solo se aceptan PDF o imagenes del plano (JPG, PNG, WEBP)");
      return;
    }

    // Vista previa inmediata mientras se guarda como plano de la partida.
    if (isImageFile(file)) {
      setPiecePhoto(file);
    }

    setSavingPlano(true);
    try {
      const registered = await savePlanoToPartida(file);
      const versionId = registered?.version?.id;
      if (!versionId) {
        throw new Error("No se obtuvo la version del plano");
      }
      await loadDocs();
      setSelectedDrawingId(`version:${versionId}`);
      setPiecePhoto(null);
      await openDrawingInspection(
        {
          key: `version:${versionId}`,
          id: versionId,
          kind: "version",
          openInspectionId: null,
        },
        observations ||
          (isImageFile(file)
            ? "Revision dimensional sobre foto del plano"
            : null)
      );
    } catch (err) {
      setError(err.message || "No se pudo guardar el plano en la partida");
      if (isImageFile(file)) setPiecePhoto(file);
    } finally {
      setSavingPlano(false);
    }
  }

  async function startPieceInspection(payload, evidenceFiles = []) {
    const inspection = await api.post(
      `/api/calidad/partidas/${itemId}?action=start-inspection`,
      {
        type: inspectionType,
        qualityPieceId: piece?.id || null,
        ...payload,
      }
    );

    for (const fileMeta of evidenceFiles) {
      await api.post("/api/calidad/evidencias", {
        ...fileMeta,
        productionOrderId: productionOrderId || null,
        productionItemId: itemId,
        qualityPieceId: piece?.id || null,
        qualityInspectionId: inspection.id,
      });
    }

    return inspection;
  }

  async function confirmDimensional() {
    setBusy(true);
    setError("");
    try {
      if (drawingOptions.length > 0) {
        const selected = drawingOptions.find((o) => o.key === selectedDrawingId);
        if (!selected) {
          throw new Error("Selecciona un plano");
        }
        await openDrawingInspection(selected, observations || null);
        return;
      }

      if (!piecePhoto || !isImageFile(piecePhoto)) {
        throw new Error("Sube un PDF del plano o una foto para inspeccionar");
      }
      await handleDimensionalFile(piecePhoto);
    } catch (err) {
      setError(err.message || "No se pudo iniciar la inspeccion");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAttribute() {
    setBusy(true);
    setError("");
    try {
      if (!piecePhoto) {
        throw new Error("La revision por atributos requiere una imagen de la pieza");
      }
      if (includeLiquidPenetrant && !penetrantPhoto) {
        throw new Error("Adjunta evidencia de liquidos penetrantes");
      }
      const evidences = [await uploadPhoto(piecePhoto, "INSPECTION")];
      if (includeLiquidPenetrant && penetrantPhoto) {
        evidences.push(await uploadPhoto(penetrantPhoto, "SPECIAL"));
      }
      await startPieceInspection(
        {
          reviewKind: "ATTRIBUTE",
          includeLiquidPenetrant,
          observations: observations || null,
        },
        evidences
      );
      onStarted?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "No se pudo iniciar la inspeccion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy || savingPlano ? undefined : onClose}
      title="Tipo de inspeccion"
      description={
        piece?.label
          ? `Elige como vas a revisar ${piece.label}.`
          : "Elige el tipo de revision antes de continuar."
      }
      size="lg"
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {step === STEPS.KIND && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-[var(--radius-md)] border border-border p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              onClick={() => setStep(STEPS.DIMENSIONAL)}
            >
              <p className="font-semibold text-content">Revision dimensional</p>
              <p className="mt-1 text-sm text-content-muted">
                Sobre el plano (PDF o foto) con intervalos numerados.
              </p>
            </button>
            <button
              type="button"
              className="rounded-[var(--radius-md)] border border-border p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              onClick={() => setStep(STEPS.ATTRIBUTE)}
            >
              <p className="font-semibold text-content">Revision por atributos</p>
              <p className="mt-1 text-sm text-content-muted">
                Visual o comentarios. Requiere imagen de la pieza.
              </p>
            </button>
          </div>
        )}

        {step === STEPS.DIMENSIONAL && (
          <div className="space-y-4">
            {docsLoading ? (
              <p className="text-sm text-content-muted">Buscando planos de la partida...</p>
            ) : drawingOptions.length > 0 ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-content-muted">Plano a inspeccionar</span>
                  <select
                    className="w-full rounded-[var(--radius-md)] border border-border bg-white px-3 py-2 text-sm"
                    value={selectedDrawingId}
                    onChange={(e) => setSelectedDrawingId(e.target.value)}
                  >
                    {drawingOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </label>
                <FileDropSquare
                  label="Agregar otro plano (PDF o foto)"
                  hint="Soltar aqui"
                  accept="application/pdf,.pdf,image/*"
                  file={piecePhoto}
                  previewUrl={piecePreview}
                  onFile={handleDimensionalFile}
                  disabled={busy}
                  loading={savingPlano}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Alert variant="info" title="Sin plano cargado">
                  Suelta un PDF o una foto del plano. Se guardara en Planos de la
                  partida y se abrira la inspeccion con intervalos.
                </Alert>
                <FileDropSquare
                  label="Cargar plano / foto"
                  hint="Soltar aqui"
                  accept="application/pdf,.pdf,image/*"
                  file={piecePhoto}
                  previewUrl={piecePreview}
                  onFile={handleDimensionalFile}
                  disabled={busy}
                  loading={savingPlano}
                />
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">Observaciones</span>
              <Textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={busy || savingPlano}
                onClick={() => setStep(STEPS.KIND)}
              >
                Atras
              </Button>
              <Button loading={busy || savingPlano} onClick={confirmDimensional}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === STEPS.ATTRIBUTE && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <FileDropSquare
                label="Imagen de la pieza (obligatoria)"
                hint="Soltar aqui"
                accept="image/*"
                file={piecePhoto}
                previewUrl={piecePreview}
                onFile={setPiecePhoto}
                disabled={busy}
              />
              {includeLiquidPenetrant ? (
                <FileDropSquare
                  label="Liquidos penetrantes"
                  hint="Soltar aqui"
                  accept="image/*"
                  file={penetrantPhoto}
                  previewUrl={penetrantPreview}
                  onFile={setPenetrantPhoto}
                  disabled={busy}
                />
              ) : null}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeLiquidPenetrant}
                onChange={(e) => setIncludeLiquidPenetrant(e.target.checked)}
              />
              <span>
                Incluir revision de liquidos penetrantes
                <span className="block text-content-muted">
                  Pedira evidencia fotografica del procedimiento.
                </span>
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">Comentarios / atributos</span>
              <Textarea
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observaciones visuales, acabado, soldadura..."
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setStep(STEPS.KIND)}>
                Atras
              </Button>
              <Button loading={busy} onClick={confirmAttribute}>
                Iniciar inspeccion
              </Button>
            </div>
          </div>
        )}

        {step === STEPS.KIND && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default StartInspectionModal;
