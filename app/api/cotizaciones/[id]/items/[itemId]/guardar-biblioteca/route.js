import { withErrorHandling } from "@/lib/api/http";
import { saveQuoteItemToLibrary } from "@/domains/quotes/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return saveQuoteItemToLibrary(req, id, itemId);
});
