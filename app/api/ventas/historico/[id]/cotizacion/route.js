import { withErrorHandling } from "@/lib/api/http";
import { linkHistoryQuote } from "@/domains/sales/history";

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return linkHistoryQuote(req, id);
});
