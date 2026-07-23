import { withErrorHandling } from "@/lib/api/http";
import { purchaseOrderPdf } from "@/domains/reports/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return purchaseOrderPdf(req, id);
});
