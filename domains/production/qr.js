/** Rutas y utilidades para QR de partidas de produccion. */

export function productionScanPath(orderId, itemId) {
  return `/produccion/escaneo/${orderId}/${itemId}`;
}

export function productionScanUrl(origin, orderId, itemId) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}${productionScanPath(orderId, itemId)}`;
}
