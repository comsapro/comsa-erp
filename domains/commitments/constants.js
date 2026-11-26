/**
 * Compromisos manuales: tareas con involucrados, inicio y entrega. Cada
 * involucrado marca su parte como terminada; cuando todos terminan pasa a
 * "Por aprobar" y solo el creador (o un administrador) la cierra.
 *
 * Sin dependencias de servidor para usarse en cliente y pruebas.
 */

export const COMMITMENT_STATUSES = ["OPEN", "IN_REVIEW", "CLOSED", "CANCELLED"];

export const COMMITMENT_STATUS_LABELS = {
  OPEN: "En proceso",
  IN_REVIEW: "Por aprobar",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export const COMMITMENT_STATUS_TONES = {
  OPEN: "brand",
  IN_REVIEW: "warning",
  CLOSED: "success",
  CANCELLED: "neutral",
};

export const COMMITMENT_COMMENT_KIND_LABELS = {
  COMMENT: "Comentario",
  DONE: "Marcó como terminado",
  REOPENED: "Reabrió su parte",
  APPROVED: "Aprobó y cerró",
  REJECTED: "Rechazó el cierre",
  CANCELLED: "Canceló el compromiso",
  CREATED: "Creó el compromiso",
  EDITED: "Editó el compromiso",
};

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

/** YYYY-MM-DD de hoy en Mexico. */
export function todayMx(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isCommitmentOverdue(c, today = todayMx()) {
  if (!c || c.status === "CLOSED" || c.status === "CANCELLED") return false;
  return String(c.dueDate).slice(0, 10) < today;
}

/**
 * Estado que corresponde tras un cambio en los involucrados: si todos ya
 * terminaron pasa a revision; si alguno reabrio vuelve a "En proceso".
 */
export function nextStatusFromParticipants(current, participants) {
  if (current === "CLOSED" || current === "CANCELLED") return current;
  const all = participants.length > 0 && participants.every((p) => p.completedAt);
  return all ? "IN_REVIEW" : "OPEN";
}

/** Permisos derivados para la vista (usuario, compromiso y si es admin). */
export function commitmentAbilities(c, { userId, isAdmin = false, canViewAll = false } = {}) {
  const isCreator = c?.createdBy === userId;
  const me = (c?.participants || []).find((p) => p.userId === userId) || null;
  const active = c && c.status !== "CLOSED" && c.status !== "CANCELLED";
  return {
    isCreator,
    isParticipant: Boolean(me),
    canView: Boolean(isCreator || me || isAdmin || canViewAll),
    canComment: Boolean(active && (isCreator || me || isAdmin)),
    canMarkDone: Boolean(active && me && !me.completedAt),
    canReopenMine: Boolean(active && me && me.completedAt),
    canApprove: Boolean(c?.status === "IN_REVIEW" && (isCreator || isAdmin)),
    canReject: Boolean(c?.status === "IN_REVIEW" && (isCreator || isAdmin)),
    canEdit: Boolean(active && (isCreator || isAdmin)),
    canCancel: Boolean(active && (isCreator || isAdmin)),
  };
}
