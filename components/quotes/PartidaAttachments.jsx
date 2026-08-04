"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Trash2, FileText, ExternalLink, Factory, Briefcase } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";

const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.pdf,.step,.stp,.sldprt,.sldasm,.slddrw,.dxf,.dwg,.x_t,.x_b,.iges,.igs,.stl,.obj,.3mf,.prt,.asm,image/*,application/pdf,application/octet-stream";

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

function isImage(contentType, fileName = "") {
  if (String(contentType || "").startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(fileName);
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

function AttachmentSection({
  title,
  description,
  icon: Icon,
  audience,
  quoteId,
  itemId,
  items,
  canEdit,
  uploading,
  progress,
  deletingId,
  onPick,
  onDelete,
  inputRef,
  onFiles,
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          {Icon && (
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />
          )}
          <div>
            <p className="text-sm font-semibold text-content">{title}</p>
            <p className="text-xs text-content-muted">{description}</p>
          </div>
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => onFiles(e, audience)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={uploading === audience}
              onClick={() => onPick(audience)}
            >
              <ImagePlus className="h-4 w-4" />{" "}
              {uploading === audience && progress != null
                ? `${progress}%`
                : "Adjuntar"}
            </Button>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-content-muted">Sin archivos.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((att) => {
            const href = blobUrl(att.pathname);
            const image = isImage(att.contentType, att.fileName);
            return (
              <li
                key={att.id}
                className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-white"
              >
                <a href={href} target="_blank" rel="noreferrer" className="block">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={href}
                      alt={att.fileName}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-surface-muted text-content-muted">
                      <FileText className="h-8 w-8" />
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

/**
 * Adjuntos por partida: documentacion ventas + archivos produccion.
 */
export function PartidaAttachments({
  quoteId,
  itemId,
  initialAttachments = [],
  canEdit = false,
  compact = false,
}) {
  const { toast } = useToast();
  const salesInputRef = useRef(null);
  const prodInputRef = useRef(null);
  const [items, setItems] = useState(initialAttachments || []);
  const [uploading, setUploading] = useState(null);
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
      /* keep */
    }
  }, [quoteId, itemId]);

  const onPick = (audience) => {
    if (audience === "PRODUCTION") prodInputRef.current?.click();
    else salesInputRef.current?.click();
  };

  const onFiles = async (e, audience) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !quoteId || !itemId) return;

    setUploading(audience);
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
          clientPayload: JSON.stringify({ audience }),
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            setProgress(Math.round(percentage || 0));
          },
        });

        await api.post(`/api/cotizaciones/${quoteId}/items/${itemId}/adjuntos`, {
          pathname: blob.pathname,
          url: blob.url,
          fileName: file.name,
          contentType: file.type || blob.contentType || "application/octet-stream",
          sizeBytes: file.size,
          audience,
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
      setUploading(null);
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
        Guarda la partida primero para poder adjuntar archivos.
      </p>
    );
  }

  const sales = items.filter((a) => (a.audience || "SALES") === "SALES");
  const production = items.filter((a) => a.audience === "PRODUCTION");

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div>
        <p className="text-sm font-semibold text-content">Archivos de la partida</p>
        {!compact && (
          <p className="text-xs text-content-muted">
            Imagenes, PDF y CAD (STEP, SLDPRT, SLDASM, DXF, x_t, …) · max. {MAX_MB}{" "}
            MB c/u
          </p>
        )}
      </div>

      <AttachmentSection
        title="Documentacion (ventas)"
        description="Solo uso comercial / cotizacion. No se envia a piso como material de fabricacion."
        icon={Briefcase}
        audience="SALES"
        quoteId={quoteId}
        itemId={itemId}
        items={sales}
        canEdit={canEdit}
        uploading={uploading}
        progress={progress}
        deletingId={deletingId}
        onPick={onPick}
        onDelete={onDelete}
        inputRef={salesInputRef}
        onFiles={onFiles}
      />

      <AttachmentSection
        title="Archivos para produccion"
        description="Planos, modelos 3D y anexos que produccion necesita para fabricar."
        icon={Factory}
        audience="PRODUCTION"
        quoteId={quoteId}
        itemId={itemId}
        items={production}
        canEdit={canEdit}
        uploading={uploading}
        progress={progress}
        deletingId={deletingId}
        onPick={onPick}
        onDelete={onDelete}
        inputRef={prodInputRef}
        onFiles={onFiles}
      />
    </div>
  );
}

export default PartidaAttachments;
