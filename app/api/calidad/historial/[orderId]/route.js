import { withErrorHandling } from "@/lib/api/http";
import { projectHistory } from "@/domains/quality/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { orderId } = await ctx.params;
  return projectHistory(req, orderId);
});
