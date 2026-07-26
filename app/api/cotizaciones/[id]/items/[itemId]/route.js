import { withErrorHandling } from "@/lib/api/http";
import {
  deleteQuoteItem,
  toggleQuoteItemStatus,
} from "@/domains/quotes/service";

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return deleteQuoteItem(req, id, itemId);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return toggleQuoteItemStatus(req, id, itemId);
});
