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

export const PRODUCTION_ITEM_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export const PRODUCTION_PRIORITY_LABELS = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRODUCTION_PRIORITY_TONES = {
  LOW: "neutral",
  NORMAL: "brand",
  HIGH: "warning",
  URGENT: "danger",
};

export const PRODUCTION_ACTIVITY_TYPES = [
  "NOTE",
  "STATUS",
  "HOURS_MANUAL",
  "SESSION_START",
  "SESSION_PAUSE",
  "SESSION_RESUME",
  "SESSION_END",
  "PROCESS_CHANGE",
  "INCIDENT",
  "MATERIAL",
  "PHOTO",
  "REOPEN",
  "CLOSE",
  "PLANNING",
];

export const PRODUCTION_ACTIVITY_LABELS = {
  NOTE: "Comentario",
  STATUS: "Estatus",
  HOURS_MANUAL: "Horas",
  SESSION_START: "Inicio de sesion",
  SESSION_PAUSE: "Pausa",
  SESSION_RESUME: "Reanudacion",
  SESSION_END: "Fin de sesion",
  PROCESS_CHANGE: "Proceso",
  INCIDENT: "Incidencia",
  MATERIAL: "Material",
  PHOTO: "Evidencia",
  REOPEN: "Retrabajo",
  CLOSE: "Cierre",
  PLANNING: "Planeacion",
};

export const PRODUCTION_ACTIVITY_FILTERS = {
  ALL: null,
  TIMES: ["HOURS_MANUAL", "SESSION_START", "SESSION_PAUSE", "SESSION_RESUME", "SESSION_END"],
  COMMENTS: ["NOTE"],
  INCIDENTS: ["INCIDENT"],
  PHOTOS: ["PHOTO"],
};

export const PRODUCTION_INCIDENT_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
];

export const PRODUCTION_INCIDENT_STATUS_LABELS = {
  OPEN: "Abierta",
  IN_REVIEW: "En revision",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada",
};

export const PRODUCTION_INCIDENT_TYPES = [
  "ORDER",
  "ITEM",
  "PROCESS",
  "MATERIAL",
  "MACHINERY",
  "DOCUMENTATION",
  "OTHER",
];

export const PRODUCTION_INCIDENT_TYPE_LABELS = {
  ORDER: "Orden",
  ITEM: "Partida",
  PROCESS: "Proceso",
  MATERIAL: "Material",
  MACHINERY: "Maquinaria",
  DOCUMENTATION: "Documentacion",
  OTHER: "Otro",
};

export const OPEN_INCIDENT_STATUSES = ["OPEN", "IN_REVIEW"];

export const SESSION_STATUS_LABELS = {
  RUNNING: "En curso",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
};
