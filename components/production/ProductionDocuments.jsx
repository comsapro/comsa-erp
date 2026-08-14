"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CloudUpload, Download, FileText, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Can } from "@/components/permissions/Can";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";

const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.pdf,.step,.stp,.sldprt,.sldasm,.slddrw,.dxf,.dwg,.x_t,.x_b,.iges,.igs,.stl,.obj,.3mf,.prt,.asm,image/*,application/pdf,application/octet-stream";

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function FileRow({ file, href, meta, onDelete, deleting, canDelete }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-content-muted" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content">
            {file.fileName}
          </p>
          {meta ? (
            <p className="truncate text-xs text-content-muted">{meta}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          as="a"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <Download className="h-4 w-4" /> Descargar
        </Button>
        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            loading={deleting}
            onClick={onDelete}
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-danger-700" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ProductionDocuments({
  productionId,
  initialAttachments = [],
  canUpload = false,
}) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setAttachments(initialAttachments || []);
  }, [initialAttachments]);

  const reload = useCallback(async () => {
    try {
      const rows = await api.get(`/api/produccion/${productionId}/adjuntos`);
      setAttachments(Array.isArray(rows) ? rows : rows?.data || []);
    } catch {
      /* keep */
    }
  }, [productionId]);

  const uploadFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length || !productionId) return;

    setUploading(true);
    setProgress(null);
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} supera ${MAX_MB} MB`);
        }
        const safeName = sanitizeFileName(file.name);
        const pathname = `production/${productionId}/${Date.now()}-${safeName}`;

        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/produccion/${productionId}/adjuntos/upload`,
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            setProgress(Math.round(percentage || 0));
          },
        });

        await api.post(`/api/produccion/${productionId}/adjuntos`, {
          pathname: blob.pathname,
          url: blob.url,
          fileName: file.name,
          contentType:
            file.type || blob.contentType || "application/octet-stream",
          sizeBytes: file.size,
          kind: "SCAN",
        });
      }
      toast({ variant: "success", title: "Archivo(s) adjuntado(s)" });
      await reload();
    } catch (err) {
      toast({
        variant: "error",
        title: "Error al subir",
        description: err.message,
      });
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const onDelete = async (attachment) => {
    setDeletingId(attachment.id);
    try {
      await api.del(
        `/api/produccion/${productionId}/adjuntos/${attachment.id}`
      );
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      toast({ variant: "success", title: "Adjunto eliminado" });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err.message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold">Documentacion de produccion</h2>
        <p className="text-xs text-content-muted">
          Escaneos o fotos de formatos llenados a pluma · max. {MAX_MB} MB.
          El control dimensional y la orden de trabajo se generan por partida.
        </p>
      </div>

      {canUpload ? (
        <Can permission="production.update_progress">
          <div
            className={cn(
              "m-4 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-4 py-8 text-center transition-colors",
              dragOver
                ? "border-brand-500 bg-brand-50"
                : "border-border bg-surface-muted/40"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              uploadFiles(e.dataTransfer.files);
            }}
          >
            <CloudUpload className="h-8 w-8 text-content-muted" />
            <p className="text-sm text-content-muted">
              Arrastra archivos aqui o adjunta escaneos del formato llenado
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading && progress != null
                ? `Subiendo ${progress}%`
                : "Adjuntar archivos"}
            </Button>
          </div>
        </Can>
      ) : null}

      <ul>
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-sm text-content-muted">
            Sin archivos de produccion adjuntos.
          </li>
        ) : (
          attachments.map((att) => (
            <FileRow
              key={att.id}
              file={att}
              href={blobUrl(att.pathname)}
              meta={formatBytes(att.sizeBytes || 0)}
              canDelete={canUpload}
              deleting={deletingId === att.id}
              onDelete={() => onDelete(att)}
            />
          ))
        )}
      </ul>
    </Card>
  );
}

export default ProductionDocuments;
