import { withErrorHandling } from "@/lib/api/http";
import { updateItemPlanning } from "@/domains/production/planning";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return updateItemPlanning(req, id, itemId);
});
