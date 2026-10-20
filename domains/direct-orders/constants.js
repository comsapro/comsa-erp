export const DIRECT_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "QUOTED",
  "IN_PRODUCTION",
  "REJECTED",
  "CANCELLED",
];

export const DIRECT_ORDER_STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de aprobacion",
  APPROVED: "Aprobada",
  QUOTED: "Cotizada",
  IN_PRODUCTION: "En produccion",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export const DIRECT_ORDER_STATUS_TONES = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  QUOTED: "brand",
  IN_PRODUCTION: "brand",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export const ORDER_TYPES = [
  "GENERAL",
  "URGENT",
  "WAREHOUSE",
  "DIRECT_ORDER_REFERENCE",
];

export const ORDER_TYPE_LABELS = {
  GENERAL: "General",
  URGENT: "Urgente",
  WAREHOUSE: "Almacen",
  DIRECT_ORDER_REFERENCE: "Referencia orden directa",
};

/** Transiciones de estatus permitidas para ordenes directas. */
export const VALID_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["QUOTED", "IN_PRODUCTION"],
  QUOTED: [],
  REJECTED: ["DRAFT"],
  CANCELLED: [],
  IN_PRODUCTION: ["PENDING_APPROVAL"],
};

export function directStatusForQuote(quote) {
  if (!quote) return "DRAFT";
  if (quote.status === "CANCELLED") return "CANCELLED";
  if (quote.status === "REJECTED") return "REJECTED";
  if (quote.status === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (quote.status === "APPROVED") return "APPROVED";
  if (quote.status === "IN_PRODUCTION" || quote.status === "SELLER_REVIEW") {
    return "IN_PRODUCTION";
  }
  return "DRAFT";
}

export function directOrderSearchOr(q) {
  if (!q) return null;
  const contains = { contains: q, mode: "insensitive" };
  return [
    { folio: contains },
    { requisition: contains },
    { client: { commercialName: contains } },
    { quote: { folio: contains } },
    { productionOrder: { folio: contains } },
  ];
}

/**
 * Se puede enviar a aprobacion si hay partidas en la cotizacion ligada
 * o, en ordenes legacy sin cotizacion, al menos un item simple.
 */
export function directOrderCanSubmit(order) {
  if (!order) return false;
  if (order.quote) {
    return (order.quote.items?.length || 0) > 0;
  }
  return (order.items?.length || 0) > 0;
}
