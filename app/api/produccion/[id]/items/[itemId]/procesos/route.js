import { withErrorHandling } from "@/lib/api/http";
import { addProductionProcess } from "@/domains/production/processes";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return addProductionProcess(req, id, itemId);
});
