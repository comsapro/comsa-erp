"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function isPdfLike(file) {
  if (!file) return false;
  return (
    file.type === "application/pdf" || /\.pdf$/i.test(String(file.name || ""))
  );
}

function isImageLike(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(String(file.name || ""));
}

export function FileDropSquare({
  label,
  hint = "Arrastra aqui o haz clic",
  accept = "image/*",
  file = null,
  previewUrl = null,
  onFile,
  disabled = false,
  loading = false,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const isPdf = isPdfLike(file);
  const displayPreview = previewUrl || localPreview;

  useEffect(() => {
    if (previewUrl || !file || !isImageLike(file)) {
      setLocalPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, previewUrl]);

  function takeFile(list) {
    const next = list?.[0] || null;
    if (!next) return;
    onFile?.(next);
  }

  return (
    <div className="space-y-1.5">
      {label ? <p className="text-sm text-content-muted">{label}</p> : null}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !loading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !loading) takeFile(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex h-36 w-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-md)] border-2 border-dashed text-center transition-colors",
          (disabled || loading) && "cursor-not-allowed opacity-60",
          dragOver
            ? "border-brand-500 bg-brand-50"
            : file
              ? "border-brand-300 bg-brand-50/40"
              : "border-border bg-surface-muted/40 hover:border-brand-300 hover:bg-brand-50/30"
        )}
        aria-label={label || "Cargar archivo"}
      >
        {loading ? (
          <span className="px-2 text-xs font-medium text-content-muted">
            Guardando...
          </span>
        ) : displayPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayPreview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : isPdf ? (
          <>
            <FileText className="h-8 w-8 text-brand-700" aria-hidden="true" />
            <span className="px-2 text-xs font-medium text-content">
              {file.name}
            </span>
          </>
        ) : (
          <>
            <ImagePlus className="h-8 w-8 text-content-muted" aria-hidden="true" />
            <span className="px-2 text-xs font-medium text-content-muted">
              {file ? file.name : hint}
            </span>
          </>
        )}
        {file && displayPreview ? (
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
            {file.name}
          </span>
        ) : null}      </button>
      {file && !loading ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-content-muted hover:text-danger-700"
          onClick={() => onFile?.(null)}
          disabled={disabled}
        >
          <X className="h-3 w-3" /> Quitar
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || loading}
        onChange={(e) => {
          takeFile(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default FileDropSquare;
