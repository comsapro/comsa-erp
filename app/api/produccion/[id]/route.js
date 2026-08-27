import { withErrorHandling } from "@/lib/api/http";
import { getProduction } from "@/domains/production/service";
import { updateOrderPlanning } from "@/domains/production/planning";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getProduction(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateOrderPlanning(req, id);
});
