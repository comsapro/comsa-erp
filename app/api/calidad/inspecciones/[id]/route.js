import { withErrorHandling } from "@/lib/api/http";
import { getInspection, updateInspection } from "@/domains/quality/drawings";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getInspection(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateInspection(req, id);
});
