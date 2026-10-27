import { withErrorHandling } from "@/lib/api/http";
import { reworkOrderPdf } from "@/domains/quality/pdf";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return reworkOrderPdf(req, id);
});
