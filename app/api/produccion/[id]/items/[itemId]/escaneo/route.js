import { withErrorHandling } from "@/lib/api/http";
import { applyScanAction, getScanContext } from "@/domains/production/scan";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return getScanContext(req, id, itemId);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return applyScanAction(req, id, itemId);
});
