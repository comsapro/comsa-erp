import "server-only";
import { prisma } from "@/lib/db";

// Acciones estandar registradas en la bitacora.
export const AUDIT_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  ACTIVATE: "activate",
  DEACTIVATE: "deactivate",
  DELETE: "delete",
  APPROVE: "approve",
  REJECT: "reject",
  CANCEL: "cancel",
  PERMISSIONS_CHANGE: "permissions_change",
  INVENTORY_ADJUST: "inventory_adjust",
};

// Serializa datos removiendo campos sensibles antes de guardarlos.
function sanitize(data) {
  if (!data || typeof data !== "object") return data ?? null;
  const clone = { ...data };
  delete clone.passwordHash;
  delete clone.password;
  // Prisma Decimal / Date -> JSON serializable.
  return JSON.parse(JSON.stringify(clone));
}

// Registra un evento en audit_logs. No debe interrumpir la operacion
// principal: los errores de auditoria se registran pero no se propagan.
export async function recordAudit({
  actor,
  module,
  entity,
  entityId,
  action,
  previousData = null,
  newData = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.id || null,
        module,
        entity,
        entityId: entityId ? String(entityId) : null,
        action,
        previousData: sanitize(previousData),
        newData: sanitize(newData),
        ipAddress: actor?.ip || null,
        userAgent: actor?.userAgent || null,
      },
    });
  } catch (error) {
    console.error("[audit] No se pudo registrar el evento:", error);
  }
}
