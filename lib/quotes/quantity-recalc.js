import {
  calculateQuoteItemTotals,
  calculateQuoteHeaderTotals,
  persistedQuoteItemTotals,
  money,
  toNumber,
} from "./calculations.js";

export const RECALC_STATUSES = ["DRAFT", "PENDING_APPROVAL"];

/**
 * Calcula los totales de una cotizacion con lineas por pieza x cantidad.
 * `quote.items` debe traer manufacturing, materials, extras e installations
 * con su `amount` guardado.
 */
export function planQuoteQuantityRecalc(quote) {
  const items = (quote.items || []).map((item) => {
    const totals = calculateQuoteItemTotals({
      manufacturing: item.manufacturing || [],
      materials: item.materials || [],
      extras: item.extras || [],
      installations: item.installations || [],
      benefitPercentage: item.benefitPercentage,
      discountPercentage: item.discountPercentage,
      quantity: item.quantity,
    });
    return {
      id: item.id,
      status: item.status,
      data: persistedQuoteItemTotals(totals),
      totals,
    };
  });

  const header = calculateQuoteHeaderTotals(
    items.filter((it) => it.status === "ACTIVE").map((it) => it.totals)
  );
  const previousTotal = money(toNumber(quote.total));

  return {
    items,
    header,
    previousTotal,
    newTotal: header.total,
    changed: Math.abs(header.total - previousTotal) >= 0.01,
  };
}

/** apply: se recalcula; backfill: solo se guarda unitSalePrice; report: no se toca. */
export function recalcDecision(quote, plan) {
  if (!plan.changed) return "backfill";
  return RECALC_STATUSES.includes(quote.status) ? "apply" : "report";
}
