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
  SUBMIT: "submit",
  RETURN_TO_DRAFT: "return_to_draft",
  SEND_TO_PRODUCTION: "send_to_production",
  CONVERT_TO_QUOTE: "convert_to_quote",
  PRINT: "print",
  PROGRESS_UPDATE: "progress_update",
  COMPLETE: "complete",
  ENTRY: "entry",
  EXIT: "exit",
  TRANSFER: "transfer",
  RECEIVE: "receive",
  PDF_GENERATE: "pdf_generate",
  REPORT_GENERATE: "report_generate",
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
