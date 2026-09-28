export const QUALITY_INSPECTION_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
];

export const QUALITY_INSPECTION_STATUS_LABELS = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
};

export const QUALITY_INSPECTION_STATUS_TONES = {
  DRAFT: "neutral",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  REJECTED: "danger",
};

export const QUALITY_STATUS = {
  NOT_INSPECTED: "NOT_INSPECTED",
  IN_PROGRESS: "IN_PROGRESS",
  PASSED: "PASSED",
  FAILED: "FAILED",
};

export const QUALITY_STATUS_LABELS = {
  NOT_INSPECTED: "Sin inspeccionar",
  IN_PROGRESS: "En proceso",
  PASSED: "Aprobada",
  FAILED: "Rechazada",
};

export const QUALITY_STATUS_TONES = {
  NOT_INSPECTED: "neutral",
  IN_PROGRESS: "brand",
  PASSED: "success",
  FAILED: "danger",
};

export const QUALITY_DOCUMENT_TYPES = [
  "DRAWING",
  "SPECIFICATION",
  "QUALITY_PLAN",
  "OTHER",
];

export const QUALITY_DOCUMENT_TYPE_LABELS = {
  DRAWING: "Plano",
  SPECIFICATION: "Especificacion",
  QUALITY_PLAN: "Plan de calidad",
  OTHER: "Otro",
};

export const QUALITY_SOURCE_KINDS = [
  "QUOTE_ATTACHMENT",
  "PRODUCTION_ATTACHMENT",
  "QUALITY_UPLOAD",
];

export const ANNOTATION_TYPES = ["MEASUREMENT", "COMMENT", "OBSERVATION"];

export const ANNOTATION_TYPE_LABELS = {
  MEASUREMENT: "Medicion",
  COMMENT: "Comentario",
  OBSERVATION: "Observacion",
};

export const ANNOTATION_STATUSES = ["OPEN", "PASS", "FAIL", "NOT_APPLICABLE"];

export const ANNOTATION_STATUS_LABELS = {
  OPEN: "Abierto",
  PASS: "Pasa",
  FAIL: "No pasa",
  NOT_APPLICABLE: "N/A",
};

export const MEASUREMENT_UNITS = ["mm", "in", "deg", "other"];

export const MEASUREMENT_UNIT_LABELS = {
  mm: "mm",
  in: "in",
  deg: "deg",
  other: "Otro",
};

export const VALID_INSPECTION_TRANSITIONS = {
  DRAFT: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
};

export const EDITABLE_INSPECTION_STATUSES = ["DRAFT", "IN_PROGRESS"];

export const PDF_CONTENT_TYPE = "application/pdf";
