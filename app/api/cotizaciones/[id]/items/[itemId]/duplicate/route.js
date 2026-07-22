import { withErrorHandling } from "@/lib/api/http";
import { duplicateQuoteItem } from "@/domains/quotes/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return duplicateQuoteItem(req, id, itemId);
});
