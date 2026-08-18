import { withErrorHandling } from "@/lib/api/http";
import {
  getProductionActivity,
  addProductionComment,
} from "@/domains/production/activity";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getProductionActivity(req, id);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return addProductionComment(req, id);
});
