export const DIRECT_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "QUOTED",
  "IN_PRODUCTION",
  "REJECTED",
  "CANCELLED",
];

export const DIRECT_ORDER_STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de aprobacion",
  APPROVED: "Aprobada",
  QUOTED: "Cotizada",
  IN_PRODUCTION: "En produccion",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export const DIRECT_ORDER_STATUS_TONES = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  QUOTED: "brand",
  IN_PRODUCTION: "brand",
  REJECTED: "danger",
  CANCELLED: "neutral",
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

/** Transiciones de estatus permitidas para ordenes directas. */
export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["QUOTED", "IN_PRODUCTION"],
  QUOTED: [],
  REJECTED: ["DRAFT"],
  CANCELLED: [],
  IN_PRODUCTION: [],
};
