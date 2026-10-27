"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Minus,
  Plus,
  Maximize2,
  RectangleHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import { cn } from "@/lib/utils/cn";

const ZOOM_STEP = 1.2;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

export function ImageDrawingViewer({
  url,
  page = 1,
  placementMode = false,
  onPlace,
  children,
  className,
}) {
  const viewportRef = useRef(null);
  const imgRef = useRef(null);
  const [fitMode, setFitMode] = useState("width");
  const [userScale, setUserScale] = useState(1);
  const [layoutTick, setLayoutTick] = useState(0);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [rendered, setRendered] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setNatural({ width: 0, height: 0 });
    setRendered({ width: 0, height: 0 });
  }, [url]);

  const computeSize = useCallback(() => {
    const container = viewportRef.current;
    if (!container || !natural.width || !natural.height) {
      return { width: 0, height: 0 };
    }
    const availW = Math.max(120, container.clientWidth - 16);
    const availH = Math.max(120, container.clientHeight - 16);
    let base;
    if (fitMode === "page") {
      base = Math.min(availW / natural.width, availH / natural.height);
    } else {
      base = availW / natural.width;
    }
    const scale = base * userScale;
    return {
      width: Math.max(1, Math.floor(natural.width * scale)),
      height: Math.max(1, Math.floor(natural.height * scale)),
    };
  }, [fitMode, natural.height, natural.width, userScale]);

  useEffect(() => {
    if (!natural.width) return;
    setRendered(computeSize());
  }, [computeSize, layoutTick, natural.width]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setLayoutTick((n) => n + 1), 80);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const onImageClick = (event) => {
    if (!placementMode || !onPlace || !rendered.width) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onPlace({
      xPosition: Math.min(1, Math.max(0, x)),
      yPosition: Math.min(1, Math.max(0, y)),
      pageNumber: page || 1,
    });
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <span className="text-sm tabular-nums text-content">Foto / plano</span>
        <div className="mx-2 h-5 w-px bg-border" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Alejar"
          onClick={() =>
            setUserScale((s) => Math.max(MIN_SCALE, s / ZOOM_STEP))
          }
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-content-muted">
          {Math.round(userScale * 100)}%
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Acercar"
          onClick={() =>
            setUserScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP))
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={fitMode === "width" ? "subtle" : "ghost"}
          onClick={() => {
            setFitMode("width");
            setUserScale(1);
          }}
        >
          <RectangleHorizontal className="h-4 w-4" /> Ancho
        </Button>
        <Button
          type="button"
          size="sm"
          variant={fitMode === "page" ? "subtle" : "ghost"}
          onClick={() => {
            setFitMode("page");
            setUserScale(1);
          }}
        >
          <Maximize2 className="h-4 w-4" /> Pagina
        </Button>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-auto bg-surface-muted",
          placementMode && "cursor-crosshair"
        )}
      >
        {error ? (
          <div className="p-4">
            <Alert variant="danger" title="Error al cargar la imagen">
              {error}
            </Alert>
          </div>
        ) : (
          <div className="flex justify-center p-2">
            <div
              className="relative shadow-md"
              style={{
                width: rendered.width || undefined,
                height: rendered.height || undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={url}
                alt="Plano fotografico"
                className="block max-w-none select-none"
                style={{
                  width: rendered.width || "auto",
                  height: rendered.height || "auto",
                }}
                draggable={false}
                onClick={onImageClick}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNatural({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                  setLoading(false);
                }}
                onError={() => {
                  setError("No se pudo cargar la imagen del plano");
                  setLoading(false);
                }}
              />
              {rendered.width > 0
                ? children?.({
                    width: rendered.width,
                    height: rendered.height,
                    page: page || 1,
                  })
                : null}
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageDrawingViewer;
