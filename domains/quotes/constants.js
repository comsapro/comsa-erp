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
  PENDING_APPROVAL: "Pendiente de aprobacion",
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

/** Transiciones de estatus permitidas para cotizaciones. */
export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["IN_PRODUCTION"],
  REJECTED: ["DRAFT"],
  CANCELLED: [],
  IN_PRODUCTION: [],
};
