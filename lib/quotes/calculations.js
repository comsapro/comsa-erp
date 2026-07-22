/** Redondeo monetario a 2 decimales (NUMERIC). */
export function money(value) {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
}

export const TAX_RATE = 0.16;
export const DEFAULT_BENEFIT = 30;
export const MIN_BENEFIT_SALES = 30;

/**
 * Calcula totales de un item de cotizacion a partir de sus lineas y %.
 */
export function calculateQuoteItemTotals({
  manufacturing = [],
  materials = [],
  extras = [],
  installations = [],
  benefitPercentage = DEFAULT_BENEFIT,
  discountPercentage = 0,
}) {
  const manufacturingTotal = money(
    manufacturing.reduce((s, r) => s + toNumber(r.amount), 0)
  );
  const materialsTotal = money(
    materials.reduce((s, r) => s + toNumber(r.amount), 0)
  );
  const extrasTotal = money(extras.reduce((s, r) => s + toNumber(r.amount), 0));
  const installationTotal = money(
    installations.reduce((s, r) => s + toNumber(r.amount), 0)
  );
  const costTotal = money(
    manufacturingTotal + materialsTotal + extrasTotal + installationTotal
  );
  const benefitAmount = money((costTotal * toNumber(benefitPercentage)) / 100);
  const saleSubtotal = money(costTotal + benefitAmount);
  const discountAmount = money(
    (saleSubtotal * toNumber(discountPercentage)) / 100
  );
  const taxable = money(saleSubtotal - discountAmount);
  const taxAmount = money(taxable * TAX_RATE);
  const total = money(taxable + taxAmount);

  return {
    manufacturingTotal,
    materialsTotal,
    extrasTotal,
    installationTotal,
    costTotal,
    saleSubtotal,
    discountAmount,
    taxAmount,
    total,
  };
}

export function calculateQuoteHeaderTotals(items = []) {
  return {
    manufacturingTotal: money(
      items.reduce((s, i) => s + toNumber(i.manufacturingTotal), 0)
    ),
    materialsTotal: money(
      items.reduce((s, i) => s + toNumber(i.materialsTotal), 0)
    ),
    extrasTotal: money(items.reduce((s, i) => s + toNumber(i.extrasTotal), 0)),
    installationTotal: money(
      items.reduce((s, i) => s + toNumber(i.installationTotal), 0)
    ),
    costTotal: money(items.reduce((s, i) => s + toNumber(i.costTotal), 0)),
    subtotal: money(items.reduce((s, i) => s + toNumber(i.saleSubtotal), 0)),
    discountTotal: money(
      items.reduce((s, i) => s + toNumber(i.discountAmount), 0)
    ),
    taxTotal: money(items.reduce((s, i) => s + toNumber(i.taxAmount), 0)),
    total: money(items.reduce((s, i) => s + toNumber(i.total), 0)),
  };
}

export function lineAmount(quantity, unitPrice) {
  return money(toNumber(quantity) * toNumber(unitPrice));
}
