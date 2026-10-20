export const PENDING_RECEPTION_PARAM = "pendiente";
export const SELLER_PARAM = "vendedor";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias desde la factura; invoiceDate es @db.Date (medianoche UTC). */
export function daysSince(date, today = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dateUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.floor((todayUtc - dateUtc) / DAY_MS));
}

export function pendingReceptionSummary({ count, amount, oldestDate } = {}, today = new Date()) {
  const n = Number(count) || 0;
  return {
    count: n,
    amount: n ? Number(amount) || 0 : 0,
    oldestDays: n ? daysSince(oldestDate, today) : null,
  };
}

export function invoiceListHref({ pendingReception = false, sellerId } = {}) {
  const params = new URLSearchParams();
  if (pendingReception) params.set(PENDING_RECEPTION_PARAM, "1");
  if (sellerId) params.set(SELLER_PARAM, sellerId);
  const qs = params.toString();
  return `/ventas/facturas${qs ? `?${qs}` : ""}`;
}

export function parseInvoiceListFilters(searchParams = {}) {
  const read = (key) => {
    const v = typeof searchParams.get === "function" ? searchParams.get(key) : searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    pendingReception: read(PENDING_RECEPTION_PARAM) === "1",
    sellerId: read(SELLER_PARAM) || "",
  };
}
