export const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
  "CANCELLED",
];

export const PO_STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de aprobacion",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  PARTIALLY_RECEIVED: "Parcialmente recibida",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"],
  REJECTED: ["DRAFT"],
  PARTIALLY_RECEIVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Solo se imprime/PDF cuando la OC ya fue aprobada (o recibida/completada). */
export function poCanPrint(po) {
  if (!po) return false;
  return ["APPROVED", "PARTIALLY_RECEIVED", "COMPLETED"].includes(po.status);
}
