"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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

export function PdfViewer({
  url,
  page,
  onPageChange,
  onPageCount,
  placementMode = false,
  onPlace,
  children,
  className,
}) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [pageCount, setPageCount] = useState(1);
  const [fitMode, setFitMode] = useState("width");
  const [userScale, setUserScale] = useState(1);
  const [layoutTick, setLayoutTick] = useState(0);
  const [rendered, setRendered] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfReady, setPdfReady] = useState(0);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({
          url,
          withCredentials: true,
          disableFontFace: false,
        });
        const pdf = await task.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        onPageCount?.(pdf.numPages);
        setPdfReady((n) => n + 1);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "No se pudo cargar el PDF");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      pdfRef.current = null;
    };
  }, [url, onPageCount]);

  const computeScale = useCallback(
    (cssWidth, cssHeight) => {
      const container = viewportRef.current;
      if (!container || !cssWidth || !cssHeight) return 1;
      const availW = Math.max(120, container.clientWidth - 16);
      const availH = Math.max(120, container.clientHeight - 16);
      if (fitMode === "page") {
        return Math.min(availW / cssWidth, availH / cssHeight) * userScale;
      }
      return (availW / cssWidth) * userScale;
    },
    [fitMode, userScale]
  );

  useEffect(() => {
    let cancelled = false;
    const pdf = pdfRef.current;
    if (!pdf || !url) return undefined;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const current = Math.min(Math.max(1, page), pdf.numPages);
        const pdfPage = await pdf.getPage(current);
        if (cancelled) return;
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = computeScale(unscaled.width, unscaled.height);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
        setRendered({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });
        setLoading(false);
      } catch (err) {
        if (err?.name === "RenderingCancelledException") return;
        if (!cancelled) {
          setError(err?.message || "No se pudo renderizar la pagina");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [url, page, pdfReady, computeScale, layoutTick]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setLayoutTick((n) => n + 1);
      }, 80);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const onCanvasClick = (event) => {
    if (!placementMode || !onPlace || !rendered.width) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onPlace({
      xPosition: Math.min(1, Math.max(0, x)),
      yPosition: Math.min(1, Math.max(0, y)),
      pageNumber: page,
    });
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Pagina anterior"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums text-content">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Pagina siguiente"
          disabled={page >= pageCount}
          onClick={() => onPageChange?.(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
            <Alert variant="danger" title="Error al cargar el plano">
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
              <canvas
                ref={canvasRef}
                className="block max-w-none"
                onClick={onCanvasClick}
              />
              {rendered.width > 0
                ? children?.({
                    width: rendered.width,
                    height: rendered.height,
                    page,
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

export default PdfViewer;
