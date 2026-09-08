/** Días hábiles COMSA: lun–vie, excluyendo festivos en BD. */

export function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateKey(value) {
  const date = toDateOnly(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export function isWeekendUtc(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Suma N días hábiles a partir de `start` (sin contar el día de inicio).
 * @param {Date|string} start
 * @param {number} businessDays
 * @param {Set<string>|string[]} holidayKeys ISO dates YYYY-MM-DD
 */
export function addBusinessDays(start, businessDays, holidayKeys = []) {
  const holidays = holidayKeys instanceof Set ? holidayKeys : new Set(holidayKeys);
  let remaining = Math.max(0, Number(businessDays) || 0);
  let cursor = toDateOnly(start);
  if (!cursor) return null;
  if (remaining === 0) return cursor;

  while (remaining > 0) {
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = formatDateKey(cursor);
    if (isWeekendUtc(cursor) || holidays.has(key)) continue;
    remaining -= 1;
  }
  return cursor;
}

export function deliveryDaysFromQuoteItem(item) {
  const max = item?.deliveryTimeMax;
  const min = item?.deliveryTimeMin;
  const unit = String(item?.deliveryTimeUnit || "DAY").toUpperCase();
  const raw = max != null ? Number(max) : min != null ? Number(min) : 0;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (unit === "WEEK") return Math.round(raw * 5);
  if (unit === "MONTH") return Math.round(raw * 20);
  if (unit === "HOUR") return Math.max(1, Math.ceil(raw / 8));
  return Math.round(raw);
}
