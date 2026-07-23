import { ValidationError } from "../../lib/permissions/errors.js";

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
}

/** Tipos que aumentan cantidad fisica. */
export const QTY_INCREASE_TYPES = new Set([
  "ENTRY",
  "ADJUSTMENT_IN",
  "TRANSFER_IN",
]);

/** Tipos que disminuyen cantidad fisica. */
export const QTY_DECREASE_TYPES = new Set([
  "EXIT",
  "ADJUSTMENT_OUT",
  "TRANSFER_OUT",
]);

export const RESERVE_TYPES = new Set(["RESERVATION"]);
export const RELEASE_TYPES = new Set(["RELEASE"]);

/**
 * Calcula deltas de quantity / reservedQuantity para un tipo de movimiento.
 */
export function computeStockDelta(movementType, quantity) {
  const qty = toNumber(quantity);
  if (qty <= 0) {
    throw new ValidationError("La cantidad del movimiento debe ser mayor a cero");
  }
  if (QTY_INCREASE_TYPES.has(movementType)) {
    return { quantityDelta: qty, reservedDelta: 0 };
  }
  if (QTY_DECREASE_TYPES.has(movementType)) {
    return { quantityDelta: -qty, reservedDelta: 0 };
  }
  if (RESERVE_TYPES.has(movementType)) {
    return { quantityDelta: 0, reservedDelta: qty };
  }
  if (RELEASE_TYPES.has(movementType)) {
    return { quantityDelta: 0, reservedDelta: -qty };
  }
  throw new ValidationError(`Tipo de movimiento no soportado: ${movementType}`);
}

/**
 * Aplica un delta sobre un estado de stock y valida no negatividad.
 */
export function applyStockChange(current, movementType, quantity) {
  const { quantityDelta, reservedDelta } = computeStockDelta(
    movementType,
    quantity
  );
  const nextQty = toNumber(current.quantity) + quantityDelta;
  const nextReserved = toNumber(current.reservedQuantity) + reservedDelta;
  const nextAvailable = nextQty - nextReserved;

  if (nextQty < 0) {
    throw new ValidationError(
      "Stock insuficiente: la cantidad no puede ser negativa"
    );
  }
  if (nextReserved < 0) {
    throw new ValidationError("La cantidad reservada no puede ser negativa");
  }
  if (nextAvailable < 0) {
    throw new ValidationError(
      "Stock disponible insuficiente para esta operacion"
    );
  }

  return {
    quantity: nextQty,
    reservedQuantity: nextReserved,
    availableQuantity: nextAvailable,
  };
}

/** Regla de stock bajo: available <= minimum. */
export function isLowStock(availableQuantity, minimumStock) {
  return toNumber(availableQuantity) <= toNumber(minimumStock);
}
