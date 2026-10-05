import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/permissions/errors";
import { getTeamPeerUserIds } from "@/domains/teams/peers";
import { canAssignQuoteSeller, canSearchQuotesForLink, canViewAllQuotes } from "./access-rules";

export { canAssignQuoteSeller, canSearchQuotesForLink, canViewAllQuotes };

export async function resolveAssignedSellerId(requestedSellerId, actorId, existingSellerId) {
  const user = await getCurrentUser();
  if (!canAssignQuoteSeller(user)) return actorId;
  if (requestedSellerId) return requestedSellerId;
  return existingSellerId || actorId;
}

export async function assertQuoteInScope(quote) {
  const user = await getCurrentUser();
  if (!user || !quote) throw new NotFoundError("Cotizacion no encontrada");
  if (canViewAllQuotes(user)) return;
  const peerIds = await getTeamPeerUserIds(user.id);
  if (!peerIds.includes(quote.sellerId)) {
    throw new NotFoundError("Cotizacion no encontrada");
  }
}

export async function quoteListSellerWhere(requestedSellerId) {
  const user = await getCurrentUser();
  if (canViewAllQuotes(user)) {
    return requestedSellerId ? { sellerId: requestedSellerId } : {};
  }
  const peerIds = await getTeamPeerUserIds(user?.id);
  const ids = peerIds.length ? peerIds : ["__none__"];
  if (requestedSellerId && !ids.includes(requestedSellerId)) {
    return { sellerId: "__none__" };
  }
  return { sellerId: requestedSellerId || { in: ids } };
}
