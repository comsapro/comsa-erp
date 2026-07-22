import { withErrorHandling } from "@/lib/api/http";
import {
  getDirectOrder,
  updateDirectOrder,
  removeDirectOrder,
} from "@/domains/direct-orders/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getDirectOrder(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateDirectOrder(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return removeDirectOrder(req, id);
});
