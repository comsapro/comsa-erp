const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

export function formatMoney(value, currency = "MXN") {
  if (value == null || value === "") return "-";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "-";
  if (currency === "MXN") return moneyFormatter.format(amount);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parsea "$850,000.5" / "850000.5" / "850,000" a número. */
export function parseMoneyInput(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  const cleaned = String(value)
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

/** Formatea número para input editable: $850,000.50 */
export function formatMoneyInput(value) {
  const amount = parseMoneyInput(value);
  if (!Number.isFinite(amount)) return "";
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${decPart}`;
}

export function toDateInputValue(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
