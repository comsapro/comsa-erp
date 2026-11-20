import { withErrorHandling } from "@/lib/api/http";
import { getProjectOverview } from "@/domains/kpis/project";

export const GET = withErrorHandling(async (req, ctx) => {
  const { orderId } = await ctx.params;
  return getProjectOverview(req, orderId);
});
