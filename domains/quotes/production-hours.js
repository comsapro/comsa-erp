import { itemQuantity } from "../../lib/quotes/calculations.js";
import { sessionsHours } from "../production/process-rules.js";

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** Horas que producción reportó: cronómetro o el campo de horas reales, la que sea mayor. */
export function reportedProductionHours(process, now = new Date()) {
  const fromSessions = sessionsHours(process?.sessions || [], now);
  const stored = Number(process?.realHours) || 0;
  const typed = Number(process?.typedHours) || 0;
  return round3(Math.max(fromSessions, stored, typed));
}

/** La cotización guarda horas por pieza. Las de producción son el total de la partida. */
export function hoursPerPiece(totalHours, pieceQuantity) {
  const total = Number(totalHours) || 0;
  if (total <= 0) return 0;
  return round3(total / itemQuantity(pieceQuantity));
}

/**
 * La partida queda al menos con las horas de producción.
 * Si el vendedor ya capturó más, se conserva esa cantidad.
 */
export function manufacturingQuantityFromProduction(currentQuantity, perPieceHours) {
  const current = Number(currentQuantity) || 0;
  const reported = Number(perPieceHours) || 0;
  return round3(Math.max(current, reported));
}
