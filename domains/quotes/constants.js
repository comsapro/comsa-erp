export const QUOTE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PRODUCTION",
  "REJECTED",
  "CANCELLED",
];

export const QUOTE_STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "En revision",
  APPROVED: "Aprobada",
  IN_PRODUCTION: "En produccion",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export const ORDER_TYPES = [
  "GENERAL",
  "URGENT",
  "WAREHOUSE",
  "DIRECT_ORDER_REFERENCE",
];

export const ORDER_TYPE_LABELS = {
  GENERAL: "General",
  URGENT: "Urgente",
  WAREHOUSE: "Almacen",
  DIRECT_ORDER_REFERENCE: "Referencia orden directa",
};

export const CURRENCIES = ["MXN", "USD"];

export const CURRENCY_LABELS = {
  MXN: "MXN",
  USD: "USD",
};

export const DELIVERY_TIME_UNITS = ["HOUR", "DAY", "WEEK", "MONTH"];

export const DELIVERY_TIME_UNIT_LABELS = {
  HOUR: "Hora",
  DAY: "Dia",
  WEEK: "Semana",
  MONTH: "Mes",
};

/** Normaliza unidades legacy (days, dias, etc.) al enum cerrado. */
export function normalizeDeliveryTimeUnit(raw) {
  if (raw == null || raw === "") return null;
  const v = String(raw).trim().toUpperCase();
  if (DELIVERY_TIME_UNITS.includes(v)) return v;
  const map = {
    DAYS: "DAY",
    DAY: "DAY",
    DIA: "DAY",
    DIAS: "DAY",
    HOUR: "HOUR",
    HOURS: "HOUR",
    HORA: "HOUR",
    HORAS: "HOUR",
    WEEK: "WEEK",
    WEEKS: "WEEK",
    SEMANA: "WEEK",
    SEMANAS: "WEEK",
    MONTH: "MONTH",
    MONTHS: "MONTH",
    MES: "MONTH",
    MESES: "MONTH",
  };
  return map[v] || "DAY";
}

/** Transiciones de estatus permitidas para cotizaciones. */
export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["IN_PRODUCTION"],
  REJECTED: ["DRAFT"],
  CANCELLED: [],
  IN_PRODUCTION: [],
};
