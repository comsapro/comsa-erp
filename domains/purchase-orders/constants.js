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

/** Compras edita borradores; el supervisor corrige precio o proveedor antes de aprobar. */
export const PO_EDIT_PERMISSION_BY_STATUS = {
  DRAFT: "purchase_orders.edit",
  PENDING_APPROVAL: "purchase_orders.edit_pending",
};

export function poEditPermission(status) {
  return PO_EDIT_PERMISSION_BY_STATUS[status] || null;
}

export function poCanEdit(po, hasPermission) {
  const code = poEditPermission(po?.status);
  return Boolean(code && hasPermission(code));
}

/** Solo se imprime/PDF cuando la OC ya fue aprobada (o recibida/completada). */
export function poCanPrint(po) {
  if (!po) return false;
  return ["APPROVED", "PARTIALLY_RECEIVED", "COMPLETED"].includes(po.status);
}
