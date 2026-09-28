"use client";

import { cn } from "@/lib/utils/cn";

const RESULT_MARK = {
  PASS: "✓",
  FAIL: "✕",
  OPEN: "!",
  NOT_APPLICABLE: "–",
};

export function AnnotationMarker({
  annotation,
  selected,
  onSelect,
  onDragEnd,
  canMove = false,
  width,
  height,
}) {
  const x = Number(annotation.xPosition) * width;
  const y = Number(annotation.yPosition) * height;
  const result =
    annotation.measurement?.result ||
    (annotation.status === "PASS" || annotation.status === "FAIL"
      ? annotation.status
      : annotation.annotationType === "OBSERVATION"
        ? "OPEN"
        : annotation.status);
  const mark = RESULT_MARK[result] || "";
  const label = `${annotation.label}${mark ? ` ${mark}` : ""}`;
  const title = [
    `Inciso ${annotation.label}`,
    annotation.annotationType,
    annotation.title || annotation.comment || "",
    result && result !== "OPEN" ? result : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const handlePointerDown = (event) => {
    event.stopPropagation();
    onSelect?.(annotation);
    if (!canMove || !onDragEnd) return;
    const overlay = event.currentTarget.parentElement;
    if (!overlay) return;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const origin = {
      x: Number(annotation.xPosition),
      y: Number(annotation.yPosition),
    };
    const rect = overlay.getBoundingClientRect();

    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      const nx = Math.min(1, Math.max(0, origin.x + dx));
      const ny = Math.min(1, Math.max(0, origin.y + dy));
      event.currentTarget.style.left = `${nx * 100}%`;
      event.currentTarget.style.top = `${ny * 100}%`;
    };
    const onUp = (ev) => {
      event.currentTarget.releasePointerCapture(pointerId);
      overlay.removeEventListener("pointermove", onMove);
      event.currentTarget.removeEventListener("pointerup", onUp);
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      const nx = Math.min(1, Math.max(0, origin.x + dx));
      const ny = Math.min(1, Math.max(0, origin.y + dy));
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        onDragEnd({ xPosition: nx, yPosition: ny });
      }
    };
    overlay.addEventListener("pointermove", onMove);
    event.currentTarget.addEventListener("pointerup", onUp);
  };

  return (
    <button
      type="button"
      className={cn(
        "absolute z-10 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 px-1.5 text-[11px] font-bold shadow-sm transition-transform duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        selected
          ? "scale-110 border-brand-800 bg-brand-700 text-white ring-2 ring-brand-300"
          : result === "FAIL"
            ? "border-danger-700 bg-danger-50 text-danger-800"
            : result === "PASS"
              ? "border-success-700 bg-success-50 text-success-800"
              : "border-content bg-white text-content"
      )}
      style={{ left: x, top: y }}
      aria-label={title}
      title={title}
      onPointerDown={handlePointerDown}
    >
      <span aria-hidden>{label}</span>
    </button>
  );
}

export function AnnotationOverlay({
  width,
  height,
  annotations = [],
  selectedId,
  onSelect,
  onMove,
  canMove = false,
  tempMarker,
  placementMode = false,
}) {
  if (!width || !height) return null;
  return (
    <div
      className={cn(
        "absolute inset-0",
        placementMode ? "pointer-events-none" : "pointer-events-none"
      )}
      style={{ width, height }}
    >
      {annotations.map((row) => (
        <div key={row.id} className="pointer-events-auto">
          <AnnotationMarker
            annotation={row}
            selected={row.id === selectedId}
            onSelect={onSelect}
            canMove={canMove && row.id === selectedId}
            onDragEnd={
              canMove && row.id === selectedId
                ? (pos) => onMove?.(row, pos)
                : undefined
            }
            width={width}
            height={height}
          />
        </div>
      ))}
      {tempMarker ? (
        <div
          className="pointer-events-none absolute flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-brand-700 bg-brand-50 text-[11px] font-bold text-brand-800"
          style={{
            left: Number(tempMarker.xPosition) * width,
            top: Number(tempMarker.yPosition) * height,
          }}
          aria-hidden
        >
          +
        </div>
      ) : null}
    </div>
  );
}

export default AnnotationOverlay;
