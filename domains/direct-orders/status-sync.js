import { directStatusForQuote } from "./constants.js";

export async function syncCompanionDirectOrderStatus(db, quote, actorId) {
  if (!quote?.directOrderId) return null;
  const status = directStatusForQuote(quote);
  return db.directOrder.update({
    where: { id: quote.directOrderId },
    data: {
      status,
      updatedBy: actorId || null,
    },
  });
}
