"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Trash2, FileText, ExternalLink } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";

const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

function isImage(contentType) {
  return String(contentType || "").startsWith("image/");
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

/**
 * Galeria de adjuntos por partida (imagenes/PDF via Vercel Blob privado).
 * Subida client-side hasta 50 MB.
 */
export function PartidaAttachments({
  quoteId,
  itemId,
  initialAttachments = [],
  canEdit = false,
  compact = false,
}) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [items, setItems] = useState(initialAttachments || []);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setItems(initialAttachments || []);
  }, [initialAttachments]);

  const reload = useCallback(async () => {
    if (!quoteId || !itemId) return;
    try {
      const rows = await api.get(
        `/api/cotizaciones/${quoteId}/items/${itemId}/adjuntos`
      );
      setItems(Array.isArray(rows) ? rows : rows?.data || []);
    } catch {
      // silencioso: se mantienen los iniciales
    }
  }, [quoteId, itemId]);

  const onPick = () => inputRef.current?.click();

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !quoteId || !itemId) return;

    setUploading(true);
    setProgress(null);
    try {
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} supera ${MAX_MB} MB`);
        }

        const safeName = sanitizeFileName(file.name);
        const pathname = `quotes/${quoteId}/items/${itemId}/${Date.now()}-${safeName}`;

        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/cotizaciones/${quoteId}/items/${itemId}/adjuntos/upload`,
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            setProgress(Math.round(percentage || 0));
          },
        });

        await api.post(`/api/cotizaciones/${quoteId}/items/${itemId}/adjuntos`, {
          pathname: blob.pathname,
          url: blob.url,
          fileName: file.name,
          contentType: file.type || blob.contentType,
          sizeBytes: file.size,
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
        `/api/cotizaciones/${quoteId}/items/${itemId}/adjuntos/${attachment.id}`
      );
      setItems((prev) => prev.filter((a) => a.id !== attachment.id));
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

  if (!itemId) {
    return (
      <p className="text-sm text-content-muted">
        Guarda la partida primero para poder adjuntar imagenes o documentos.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-content">
            Documentos / imagenes
          </p>
          {!compact && (
            <p className="text-xs text-content-muted">
              JPG, PNG, WEBP, GIF o PDF · max. {MAX_MB} MB c/u
            </p>
          )}
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              className="hidden"
              onChange={onFiles}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={uploading}
              onClick={onPick}
            >
              <ImagePlus className="h-4 w-4" />{" "}
              {uploading && progress != null
                ? `Subiendo ${progress}%`
                : "Adjuntar"}
            </Button>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-content-muted">Sin adjuntos.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((att) => {
            const href = blobUrl(att.pathname);
            const image = isImage(att.contentType);
            return (
              <li
                key={att.id}
                className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-white"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={href}
                      alt={att.fileName}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-surface-muted text-content-muted">
                      <FileText className="h-10 w-10" />
                    </div>
                  )}
                </a>
                <div className="flex items-start justify-between gap-2 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-content">
                      {att.fileName}
                    </p>
                    <p className="text-[11px] text-content-muted">
                      {formatBytes(att.sizeBytes || 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      as="a"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Abrir"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {canEdit && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        loading={deletingId === att.id}
                        onClick={() => onDelete(att)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger-700" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PartidaAttachments;
