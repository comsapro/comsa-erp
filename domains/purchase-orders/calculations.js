import { money, toNumber, TAX_RATE } from "../../lib/quotes/calculations.js";

export function calculatePurchaseLineTotals(quantity, unitPrice) {
  const subtotal = money(toNumber(quantity) * toNumber(unitPrice));
  const taxAmount = money(subtotal * TAX_RATE);
  const total = money(subtotal + taxAmount);
  return { subtotal, taxAmount, total };
}

export function calculatePurchaseHeaderTotals(items = []) {
  return {
    subtotal: money(items.reduce((s, i) => s + toNumber(i.subtotal), 0)),
    tax: money(items.reduce((s, i) => s + toNumber(i.taxAmount), 0)),
    total: money(items.reduce((s, i) => s + toNumber(i.total), 0)),
  };
}

export function remainingQuantity(ordered, received) {
  return Math.max(0, toNumber(ordered) - toNumber(received));
}

export function resolvePurchaseItemStatus(ordered, received) {
  const rem = remainingQuantity(ordered, received);
  if (toNumber(received) <= 0) return "PENDING";
  if (rem <= 0) return "RECEIVED";
  return "PARTIAL";
}

export function resolvePurchaseOrderStatus(items) {
  if (!items.length) return "APPROVED";
  const allReceived = items.every(
    (i) => remainingQuantity(i.quantity, i.receivedQuantity) <= 0
  );
  if (allReceived) return "COMPLETED";
  const anyReceived = items.some((i) => toNumber(i.receivedQuantity) > 0);
  if (anyReceived) return "PARTIALLY_RECEIVED";
  return "APPROVED";
}

export { TAX_RATE };
