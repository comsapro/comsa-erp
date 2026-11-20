// Constantes compartidas (cliente y servidor) del Dashboard gerencial y KPIs.

export const TRACKING_STATUSES = [
  "PENDING",
  "IN_PRODUCTION",
  "IN_QUALITY",
  "FINISHED",
  "RELEASED",
  "DELAYED",
  "STOPPED",
  "DELIVERED",
];

export const TRACKING_STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_PRODUCTION: "En producción",
  IN_QUALITY: "En Calidad",
  FINISHED: "Terminado",
  RELEASED: "Liberado",
  DELAYED: "Retrasado",
  STOPPED: "Detenido",
  DELIVERED: "Entregado",
};

export const TRACKING_STATUS_TONES = {
  PENDING: "neutral",
  IN_PRODUCTION: "brand",
  IN_QUALITY: "brand",
  FINISHED: "success",
  RELEASED: "success",
  DELAYED: "danger",
  STOPPED: "danger",
  DELIVERED: "success",
};

/** Estatus que se pueden fijar manualmente (Detenido va por incidencia; Retrasado es calculado). */
export const MANUAL_TRACKING_STATUSES = [
  "PENDING",
  "IN_PRODUCTION",
  "IN_QUALITY",
  "FINISHED",
  "RELEASED",
  "DELIVERED",
];

/** Un trabajo en estos estatus ya no cuenta como compromiso abierto. */
export const DONE_TRACKING_STATUSES = ["FINISHED", "RELEASED", "DELIVERED"];

export const INCIDENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const INCIDENT_PRIORITY_LABELS = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const INCIDENT_PRIORITY_TONES = {
  LOW: "neutral",
  MEDIUM: "brand",
  HIGH: "warning",
  CRITICAL: "danger",
};

export const INCIDENT_PRIORITY_ICONS = {
  LOW: "⚪",
  MEDIUM: "🟡",
  HIGH: "🔴",
  CRITICAL: "🚨",
};

export const INCIDENT_STATUS_LABELS = {
  OPEN: "Abierta",
  IN_REVIEW: "En atención",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada",
};

export const INCIDENT_STATUS_TONES = {
  OPEN: "danger",
  IN_REVIEW: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const OPEN_INCIDENT_STATUSES = ["OPEN", "IN_REVIEW"];

export const KPI_MODULES = {
  PRODUCTION: "Producción",
  SALES: "Ventas",
  PURCHASING: "Compras",
  QUALITY: "Calidad",
  WAREHOUSE: "Almacén",
  MANAGEMENT: "Dirección",
};

export const KPI_CATALOG_TYPES = {
  STOP_REASON: "STOP_REASON",
  ERROR_CAUSE: "ERROR_CAUSE",
  ERROR_AREA: "ERROR_AREA",
};

export const KPI_CATALOG_TYPE_LABELS = {
  STOP_REASON: "Razones de paro / incidencia",
  ERROR_CAUSE: "Causas de error",
  ERROR_AREA: "Áreas de error",
};

export const SUGGESTED_RESPONSIBLE_OPTIONS = {
  NONE: "Sin sugerencia",
  SELLER: "Vendedor del proyecto",
  ITEM_ASSIGNEE: "Responsable de la partida",
};

export const DETECTION_STAGES = ["PRODUCTION", "QUALITY", "CLIENT"];

export const DETECTION_STAGE_LABELS = {
  PRODUCTION: "Interno · detectado por Producción",
  QUALITY: "Interno · detectado por Calidad",
  CLIENT: "Escape · llegó al cliente",
};

export const DETECTION_STAGE_SHORT = {
  PRODUCTION: "Producción",
  QUALITY: "Calidad",
  CLIENT: "Cliente (escape)",
};

export const COST_CONCEPTS = {
  LABOR: [
    { code: "DIAGNOSIS", label: "Horas de diagnóstico" },
    { code: "REWORK", label: "Horas de retrabajo" },
    { code: "EXTRA_FABRICATION", label: "Horas de fabricación adicional" },
    { code: "EXTRA_INSPECTION", label: "Horas de inspección adicional" },
  ],
  MATERIAL: [
    { code: "MATERIAL_WASTE", label: "Material desperdiciado" },
    { code: "MATERIAL_ADDITIONAL", label: "Material adicional" },
    { code: "MATERIAL_REWORK", label: "Material utilizado en retrabajo" },
  ],
  OTHER: [
    { code: "FREIGHT", label: "Flete" },
    { code: "URGENT_PURCHASE", label: "Compras urgentes" },
    { code: "PENALTY", label: "Penalizaciones" },
    { code: "OTHER", label: "Otros costos" },
  ],
};

export const COST_CATEGORY_LABELS = {
  LABOR: "Mano de obra",
  MATERIAL: "Materiales",
  OTHER: "Otros costos",
};

export const COST_CONCEPT_LABELS = Object.fromEntries(
  Object.values(COST_CONCEPTS)
    .flat()
    .map((c) => [c.code, c.label])
);

export const KPI_SECTIONS = [
  { key: "compromisos", label: "Trabajos y compromisos" },
  { key: "ventas", label: "Ventas" },
  { key: "recepcion", label: "Facturas por recibir" },
  { key: "cobranza", label: "Cobranza" },
  { key: "calidad", label: "Calidad" },
];

/** Campos de factura que admiten correccion auditada. */
export const CORRECTABLE_INVOICE_FIELDS = {
  invoiceDate: { label: "Fecha de facturación", type: "date" },
  sentAt: { label: "Fecha de envío al cliente", type: "date" },
  receptionDate: { label: "Fecha de recepción", type: "date" },
  creditDays: { label: "Días de crédito", type: "int" },
  dueDate: { label: "Fecha límite de pago", type: "date" },
  paidAt: { label: "Fecha de pago", type: "date" },
};

export const UNCLASSIFIED = "__NONE__";
export const UNCLASSIFIED_LABEL = "Sin clasificar";
