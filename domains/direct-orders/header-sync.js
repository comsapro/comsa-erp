export function quoteHeaderFromDirectOrder(order, quote = {}) {
  return {
    clientId: order.clientId,
    clientContactId: order.clientContactId || null,
    sellerId: order.sellerId,
    issuingCompanyId: order.issuingCompanyId,
    requestDate: order.requestDate || quote.requestDate || null,
    elaborationDate: order.requestDate || quote.elaborationDate,
    validUntil: order.validUntil || quote.validUntil,
    requisition: order.requisition ?? null,
    internalObservations: order.observations ?? null,
  };
}

export function directOrderHeaderFromQuote(quote) {
  return {
    clientId: quote.clientId,
    clientContactId: quote.clientContactId || null,
    sellerId: quote.sellerId,
    issuingCompanyId: quote.issuingCompanyId,
    requestDate: quote.requestDate || quote.elaborationDate,
    validUntil: quote.validUntil,
    requisition: quote.requisition ?? null,
    observations: quote.internalObservations ?? null,
  };
}

export async function applyCompanionQuoteHeader(db, order, actorId) {
  if (!order?.id) return null;
  const quote = await db.quote.findFirst({
    where: { directOrderId: order.id, deletedAt: null },
  });
  if (!quote) return null;
  return db.quote.update({
    where: { id: quote.id },
    data: {
      ...quoteHeaderFromDirectOrder(order, quote),
      updatedBy: actorId || null,
    },
  });
}

export async function applyCompanionDirectOrderHeader(db, quote, actorId) {
  if (!quote?.directOrderId) return null;
  return db.directOrder.update({
    where: { id: quote.directOrderId },
    data: {
      ...directOrderHeaderFromQuote(quote),
      updatedBy: actorId || null,
    },
  });
}
