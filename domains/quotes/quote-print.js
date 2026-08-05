import path from "path";
import { toNumber } from "@/lib/quotes/calculations";
import { normalizeDeliveryTimeUnit } from "@/domains/quotes/constants";

export const QUOTE_PRINT_NOTES = [
  "Condiciones de pago seran: pago del 100% a el credito establecido.",
  "Se consideran dias habiles de lunes a viernes y quitando los dias festivos.",
  "Antes de favorecernos con su PO confirmar el tiempo de entrega.",
];

export const QUOTE_PRINT_CANCELLATION = [
  {
    key: "A",
    text: "En caso de cancelacion o cambio de la PO por una cantidad menor a la establecida originalmente se realizara un cargo del 50% del valor de la PO.",
  },
  {
    key: "B",
    text: "En caso de servicios estos se podran cancelar o cambiar de fecha hasta con 48 Horas antes de realizarse el servicio.",
  },
  {
    key: "C",
    text: 'En caso de que un servicio sea cancelado despues de lo establecido en el apartado "B" se realizara el cargo mencionado en el apartado "A".',
  },
];

const DELIVERY_UNIT_PRINT = {
  HOUR: "HORAS",
  DAY: "DIAS",
  WEEK: "SEMANAS",
  MONTH: "MESES",
};

export function getComsaLogoPath() {
  return path.join(process.cwd(), "public", "branding", "comsa-logo.jpeg");
}

export function formatQuoteMoney(value, currency = "MXN") {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `$${formatted}`;
}

export function formatDeliveryPrint(item) {
  const min = item?.deliveryTimeMin;
  const max = item?.deliveryTimeMax;
  if (min == null && max == null) return { range: "-", unit: "" };
  const unitKey = normalizeDeliveryTimeUnit(item.deliveryTimeUnit) || "DAY";
  const unit = DELIVERY_UNIT_PRINT[unitKey] || "DIAS";
  if (min != null && max != null && Number(min) !== Number(max)) {
    return { range: `${min} A ${max}`, unit };
  }
  return { range: String(min ?? max), unit };
}

export function formatDateIso(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function lineUnitPrice(item) {
  const qty = toNumber(item.quantity) || 1;
  const subtotal = toNumber(item.saleSubtotal);
  return qty ? subtotal / qty : 0;
}

export function buildPaymentNote(quote) {
  if (quote?.paymentNotes && String(quote.paymentNotes).trim()) {
    return String(quote.paymentNotes).trim();
  }
  const advance = toNumber(quote?.advancePercentage);
  const settlement = toNumber(quote?.settlementPercentage);
  if (advance > 0 && Math.abs(advance + settlement - 100) <= 0.01) {
    return `Condiciones de pago seran: anticipo del ${advance}% y liquidacion del ${settlement}%.`;
  }
  if (quote?.client?.commercialTerms) {
    return `Condiciones de pago seran: pago del 100% a el credito establecido (${quote.client.commercialTerms}).`;
  }
  return QUOTE_PRINT_NOTES[0];
}

export function buildQuotePrintModel(quote) {
  const company = quote.issuingCompany || {};
  const client = quote.client || {};
  const currency = quote.currency || "MXN";
  const activeItems = (quote.items || []).filter((it) => it.status !== "INACTIVE");

  const notes = [
    buildPaymentNote(quote),
    QUOTE_PRINT_NOTES[1],
    QUOTE_PRINT_NOTES[2],
  ];

  return {
    folio: quote.folio,
    version: quote.version || "A",
    revisionLabel: `Revision ${quote.version || "A"}`,
    currency,
    currencyBanner:
      currency === "USD"
        ? "PRECIOS EN DOLARES AMERICANOS"
        : "PRECIOS EN PESOS MEXICANOS",
    company: {
      legalName:
        company.legalName ||
        company.commercialName ||
        "COMERCIALIZADORA, OPERACIONES Y MANUFACTURA, S.A. DE C.V.",
      commercialName: company.commercialName || "COMSA",
      phone: company.phone || "",
      email: company.email || "",
      address: company.fiscalAddress || "",
      rfc: company.rfc || "",
      logoUrl: company.logoUrl || "/branding/comsa-logo.jpeg",
      legalText: company.legalText || "",
    },
    meta: {
      empresa: client.commercialName || "-",
      requisicion: quote.requisition || "-",
      responsable: quote.clientContact?.name || "-",
      emitida: formatDateIso(quote.elaborationDate),
      atentamente: quote.seller?.name || "-",
      vigenciaHasta: formatDateIso(quote.validUntil),
    },
    items: activeItems.map((item) => {
      const delivery = formatDeliveryPrint(item);
      return {
        position: item.position,
        description: item.description || "",
        deliveryRange: delivery.range,
        deliveryUnit: delivery.unit,
        comments: item.clientObservations || "",
        unitPrice: formatQuoteMoney(lineUnitPrice(item), currency),
        discount: formatQuoteMoney(item.discountAmount, currency),
        quantity: Number(toNumber(item.quantity)).toFixed(2),
        amount: formatQuoteMoney(item.saleSubtotal, currency),
      };
    }),
    totals: {
      subtotal: formatQuoteMoney(quote.subtotal, currency),
      tax: formatQuoteMoney(quote.taxTotal, currency),
      total: formatQuoteMoney(quote.total, currency),
    },
    notes,
    cancellation: QUOTE_PRINT_CANCELLATION,
  };
}
