import { withErrorHandling } from "@/lib/api/http";
import { getReworkOrder } from "@/domains/quality/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getReworkOrder(req, id);
});
