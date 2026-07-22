import { withErrorHandling } from "@/lib/api/http";
import { upsertQuoteItem } from "@/domains/quotes/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return upsertQuoteItem(req, id);
});
