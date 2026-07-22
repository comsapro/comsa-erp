export const PRODUCTION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const PRODUCTION_STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const PRODUCTION_STATUS_TONES = {
  PENDING: "warning",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export const PRODUCTION_SOURCE_TYPES = ["QUOTE", "DIRECT_ORDER"];

export const PRODUCTION_SOURCE_LABELS = {
  QUOTE: "Cotizacion",
  DIRECT_ORDER: "Orden directa",
};
