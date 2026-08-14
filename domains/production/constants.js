export const PRODUCTION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REWORK",
];

export const PRODUCTION_STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  REWORK: "Retrabajo",
};

export const PRODUCTION_STATUS_TONES = {
  PENDING: "warning",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REWORK: "warning",
};

export const PRODUCTION_SOURCE_TYPES = ["QUOTE", "DIRECT_ORDER"];

export const PRODUCTION_SOURCE_LABELS = {
  QUOTE: "Cotizacion",
  DIRECT_ORDER: "Orden directa",
};
