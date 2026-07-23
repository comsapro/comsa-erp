import { withErrorHandling } from "@/lib/api/http";
import { quotationPdf } from "@/domains/reports/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return quotationPdf(req, id);
});
