/** Rutas y utilidades para QR de partidas de produccion. */

export function productionScanPath(orderId, itemId) {
  return `/produccion/escaneo/${orderId}/${itemId}`;
}

export function productionScanUrl(origin, orderId, itemId) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}${productionScanPath(orderId, itemId)}`;
}

export function resolveAppOrigin(request) {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "";
  if (fromEnv) return String(fromEnv).replace(/\/$/, "");
  try {
    const url = new URL(request?.url || "http://localhost:3000");
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Genera PNG (buffer + data URL) del QR de escaneo de una partida. */
export async function buildProductionItemQr(orderId, itemId, origin) {
  const qrUrl = productionScanUrl(origin, orderId, itemId);
  const QRCode = (await import("qrcode")).default;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const base64 = qrDataUrl.split(",")[1] || "";
  const qrBuffer = Buffer.from(base64, "base64");
  return { qrUrl, qrDataUrl, qrBuffer };
}
