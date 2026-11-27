import { withErrorHandling } from "@/lib/api/http";
import { suggestQuotesForHistory } from "@/domains/sales/history";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return suggestQuotesForHistory(req, id);
});
