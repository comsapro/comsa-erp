import { withErrorHandling } from "@/lib/api/http";
import { updateTrackingStatus } from "@/domains/kpis/incidents";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { itemId } = await ctx.params;
  return updateTrackingStatus(req, itemId);
});
