import { withErrorHandling } from "@/lib/api/http";
import { getProduction } from "@/domains/production/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getProduction(req, id);
});
