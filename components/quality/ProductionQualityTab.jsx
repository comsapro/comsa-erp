"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { useToast } from "@/components/feedback/ToastProvider";
import { Alert } from "@/components/feedback/Alert";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  QUALITY_INSPECTION_STATUS_LABELS,
  QUALITY_INSPECTION_STATUS_TONES,
  QUALITY_STATUS_LABELS,
  QUALITY_STATUS_TONES,
} from "@/domains/quality/drawing-constants";

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

export function ProductionQualityTab({
  productionId,
  item,
  itemId,
  variant = "tab",
}) {
  const { toast } = useToast();
  const id = item?.id || itemId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get(`/api/calidad/partidas/${id}/documentos`);
    setData(result);
    return result;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openDrawing = async (file) => {
    if (file.openInspectionId) {
      window.location.href = `/calidad/revision/${file.openInspectionId}`;
      return;
    }
    setActing(true);
    try {
      const created = await api.post("/api/calidad/inspecciones", {
        productionItemId: id,
        productionAttachmentId: file.id,
      });
      window.location.href = `/calidad/revision/${created.id}`;
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo abrir el plano",
        description: err.message,
      });
    } finally {
      setActing(false);
    }
  };

  const startFromVersion = async (versionId) => {
    setActing(true);
    try {
      const created = await api.post("/api/calidad/inspecciones", {
        productionItemId: id,
        qualityDocumentVersionId: versionId,
      });
      window.location.href = `/calidad/revision/${created.id}`;
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo abrir el plano",
        description: err.message,
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-content-muted">Cargando calidad...</p>;
  }
  if (error) {
    return (
      <Alert variant="danger" title="No se pudo cargar calidad">
        {error}
      </Alert>
    );
  }

  const productionFiles = data?.candidates?.production || [];
  const pdfs = productionFiles.filter((file) => file.isPdf);
  const otherFiles = productionFiles.filter((file) => !file.isPdf);
  const inspections = data?.inspections || [];
  const orderId = data?.item?.productionOrderId || productionId;
  const headerItem = data?.item;

  const extraDocuments = (data?.documents || []).filter(
    (doc) => doc.sourceKind && doc.sourceKind !== "PRODUCTION_ATTACHMENT"
  );

  const filesBlock = (
    <div className="space-y-5">
      {variant === "tab" ? (
        <Badge tone={QUALITY_STATUS_TONES[data?.qualityStatus] || "neutral"}>
          {QUALITY_STATUS_LABELS[data?.qualityStatus] || data?.qualityStatus}
        </Badge>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Documentos de la partida
        </h3>
        <p className="mb-3 text-sm text-content-muted">
          Se anotan los PDFs subidos en Produccion, en Evidencias de esta
          partida.
        </p>
        {!productionFiles.length ? (
          <Alert variant="info" title="Sin archivos en la partida">
            Sube el plano o documento en{" "}
            <Link
              href={`/produccion/${orderId}`}
              className="font-medium text-brand-700 hover:underline"
            >
              Produccion → Evidencias
            </Link>{" "}
            de esta partida. Solo los PDF se pueden anotar.
          </Alert>
        ) : !pdfs.length ? (
          <Alert variant="info" title="No hay PDF para anotar">
            Hay archivos en la partida, pero solo se pueden anotar documentos
            PDF. Sube el plano en{" "}
            <Link
              href={`/produccion/${orderId}`}
              className="font-medium text-brand-700 hover:underline"
            >
              Produccion → Evidencias
            </Link>
            .
          </Alert>
        ) : (
          <ul className="space-y-2">
            {pdfs.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-content-muted" />
                  <span className="truncate">{file.fileName}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    as="a"
                    href={blobUrl(file.pathname)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver
                  </Button>
                  <Can permission="quality.create">
                    <Button
                      size="sm"
                      loading={acting}
                      onClick={() => openDrawing(file)}
                    >
                      {file.openInspectionId ? "Continuar" : "Anotar"}
                    </Button>
                  </Can>
                  {!file.openInspectionId && file.latestInspectionId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      as="a"
                      href={`/calidad/revision/${file.latestInspectionId}`}
                    >
                      Ver ultima
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {otherFiles.length ? (
          <ul className="mt-2 space-y-2">
            {otherFiles.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-border px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-content-muted" />
                  <span className="truncate">{file.fileName}</span>
                </span>
                <span className="text-xs text-content-muted">
                  No es PDF · no se puede anotar
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {extraDocuments.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Otros documentos de calidad</h3>
          <ul className="space-y-2">
            {extraDocuments.map((doc) => {
              const current =
                (doc.versions || []).find(
                  (v) => v.versionNumber === doc.currentVersionNumber
                ) || doc.versions?.[0];
              return (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {doc.originalFilename} · rev. {doc.currentVersionNumber}
                  </span>
                  {current ? (
                    <Can permission="quality.create">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={acting}
                        onClick={() => startFromVersion(current.id)}
                      >
                        Anotar de nuevo
                      </Button>
                    </Can>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Historial de inspecciones</h3>
        {!inspections.length ? (
          <p className="text-sm text-content-muted">
            Aun no hay anotaciones en esta partida.
          </p>
        ) : (
          <ul className="space-y-2">
            {inspections.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
              >
                <Link
                  href={`/calidad/revision/${row.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {row.inspectionNumber}
                </Link>
                <span className="text-content-muted">
                  {row.qualityDocumentVersion?.originalFilename} · rev.{" "}
                  {row.qualityDocumentVersion?.versionNumber}
                </span>
                <Badge
                  tone={QUALITY_INSPECTION_STATUS_TONES[row.status] || "neutral"}
                >
                  {QUALITY_INSPECTION_STATUS_LABELS[row.status] || row.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (variant !== "page") return filesBlock;

  return (
    <div>
      <Link
        href="/calidad"
        className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Partidas
      </Link>
      <PageHeader
        title={
          headerItem
            ? `#${headerItem.position} ${headerItem.description || "Partida"}`
            : "Partida"
        }
        description={
          headerItem
            ? `${headerItem.productionFolio || "Produccion"}${
                headerItem.clientName ? ` · ${headerItem.clientName}` : ""
              }`
            : undefined
        }
        actions={
          <Badge tone={QUALITY_STATUS_TONES[data?.qualityStatus] || "neutral"}>
            {QUALITY_STATUS_LABELS[data?.qualityStatus] || data?.qualityStatus}
          </Badge>
        }
      />
      {filesBlock}
    </div>
  );
}

export default ProductionQualityTab;
