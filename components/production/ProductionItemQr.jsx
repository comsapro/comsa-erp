"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { productionScanPath } from "@/domains/production/qr";

const SIZES = {
  sm: 96,
  md: 140,
  lg: 200,
};

export function ProductionItemQr({
  orderId,
  item,
  size = "md",
  showLabel = true,
  className = "",
}) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const px = SIZES[size] || SIZES.md;
  const path = useMemo(
    () => productionScanPath(orderId, item.id),
    [orderId, item.id]
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSrc(null);

    const origin = window.location.origin;
    const url = `${origin}${path}`;

    import("qrcode")
      .then((mod) => mod.default.toDataURL(url, { width: px, margin: 1 }))
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo generar el QR");
      });

    return () => {
      cancelled = true;
    };
  }, [path, px]);

  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <Link
        href={path}
        className="group relative block rounded-md border border-border bg-white p-2 shadow-sm transition-colors hover:border-brand-400"
        title="Abrir escaneo de partida"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`QR partida ${item.position}`}
            width={px}
            height={px}
            className="block"
          />
        ) : (
          <div
            className="flex items-center justify-center bg-surface-muted text-content-muted"
            style={{ width: px, height: px }}
          >
            <QrCode className="h-8 w-8 animate-pulse" aria-hidden />
          </div>
        )}
      </Link>
      {showLabel ? (
        <div className="max-w-[160px]">
          <p className="text-xs font-semibold text-content">
            #{item.position} {item.description}
          </p>
          <p className="text-[11px] text-content-muted">Escanear para tiempos</p>
          {error ? <p className="text-[11px] text-danger-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
