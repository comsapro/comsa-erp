export const QUALITY_INSPECTION_MODES = ["FULL", "SAMPLE"];
export const QUALITY_INSPECTION_MODE_LABELS = {
  FULL: "Inspeccion 100%",
  SAMPLE: "Muestreo",
};

export const QUALITY_ITEM_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "FIRST_PIECE_PENDING",
  "WAITING_PRODUCTION",
  "CLOSED",
];
export const QUALITY_ITEM_STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En inspeccion",
  FIRST_PIECE_PENDING: "Primera pieza pendiente",
  WAITING_PRODUCTION: "Espera produccion",
  CLOSED: "Cerrada",
};

export const QUALITY_PIECE_STATUSES = [
  "PENDING",
  "IN_INSPECTION",
  "CONFORMING",
  "NON_CONFORMING",
  "REWORK",
  "RELEASED",
];
export const QUALITY_PIECE_STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_INSPECTION: "En inspeccion",
  CONFORMING: "Conforme",
  NON_CONFORMING: "No conforme",
  REWORK: "Retrabajo",
  RELEASED: "Liberada",
};

export const QUALITY_EVIDENCE_STAGES = [
  "INSPECTION",
  "DEFECT",
  "BEFORE_REWORK",
  "AFTER_REWORK",
  "SPECIAL",
  "OTHER",
];
export const QUALITY_EVIDENCE_STAGE_LABELS = {
  INSPECTION: "Inspeccion",
  DEFECT: "Defecto",
  BEFORE_REWORK: "Antes de retrabajo",
  AFTER_REWORK: "Despues de retrabajo",
  SPECIAL: "Especial",
  OTHER: "Otro",
};

export const QUALITY_INSPECTION_TYPES = ["FIRST_PIECE", "PIECE", "SAMPLE", "SPECIAL"];
export const QUALITY_INSPECTION_TYPE_LABELS = {
  FIRST_PIECE: "Primera pieza",
  PIECE: "Pieza",
  SAMPLE: "Muestra",
  SPECIAL: "Especial",
};

export const QUALITY_INSPECTION_STATUSES = ["DRAFT", "IN_PROGRESS", "CLOSED", "CANCELLED"];
export const QUALITY_INSPECTION_STATUS_LABELS = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En progreso",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const QUALITY_RESULTS = ["PENDING", "CONFORMING", "NON_CONFORMING"];
export const QUALITY_RESULT_LABELS = {
  PENDING: "Pendiente",
  CONFORMING: "Conforme",
  NON_CONFORMING: "No conforme",
};

export const QUALITY_SPECIAL_CHECK_TYPES = [
  "DIMENSIONAL",
  "VISUAL",
  "LIQUID_PENETRANT",
  "HARDNESS",
  "OTHER",
];
export const QUALITY_SPECIAL_CHECK_TYPE_LABELS = {
  DIMENSIONAL: "Dimensional",
  VISUAL: "Visual",
  LIQUID_PENETRANT: "Liquidos penetrantes",
  HARDNESS: "Dureza",
  OTHER: "Otro",
};

export const QUALITY_REWORK_STATUSES = ["REQUESTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const QUALITY_REWORK_STATUS_LABELS = {
  REQUESTED: "Solicitado",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const INSTRUMENT_STATUSES = ["ACTIVE", "DUE_SOON", "EXPIRED", "OUT_OF_SERVICE"];
export const INSTRUMENT_STATUS_LABELS = {
  ACTIVE: "Activo",
  DUE_SOON: "Proximo a calibracion",
  EXPIRED: "Calibracion vencida",
  OUT_OF_SERVICE: "Fuera de servicio",
};

export const QUALITY_ALERT_AUDIENCES = ["PRODUCTION", "SALES", "MANAGEMENT", "QUALITY"];
export const QUALITY_ALERT_STATUS = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"];

export const OPEN_QUALITY_ITEM_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "FIRST_PIECE_PENDING",
  "WAITING_PRODUCTION",
];

export function calcSampleCount(fabricatedQty, everyN) {
  const qty = Number(fabricatedQty) || 0;
  const n = Number(everyN) || 0;
  if (qty <= 0 || n <= 0) return 0;
  return Math.ceil(qty / n);
}

export function pieceLabel(num) {
  return `Pieza ${String(num).padStart(2, "0")}`;
}
