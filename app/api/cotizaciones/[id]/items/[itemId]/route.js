import { withErrorHandling } from "@/lib/api/http";
import { deleteQuoteItem } from "@/domains/quotes/service";

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return deleteQuoteItem(req, id, itemId);
});
