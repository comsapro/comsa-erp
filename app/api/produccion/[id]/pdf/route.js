import { withErrorHandling } from "@/lib/api/http";
import { productionOrderPdf } from "@/domains/reports/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return productionOrderPdf(req, id);
});
