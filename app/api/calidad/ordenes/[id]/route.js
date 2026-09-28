import { withErrorHandling } from "@/lib/api/http";
import { getOrderQuality } from "@/domains/quality/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getOrderQuality(req, id);
});
