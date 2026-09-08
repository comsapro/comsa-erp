import { withErrorHandling } from "@/lib/api/http";
import { updateSalesGoal } from "@/domains/sales/service";

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateSalesGoal(req, id);
});
