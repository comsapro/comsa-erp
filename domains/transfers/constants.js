export const TRANSFER_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "CANCELLED",
];

export const TRANSFER_STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "CANCELLED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
