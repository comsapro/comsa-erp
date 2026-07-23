import { withErrorHandling } from "@/lib/api/http";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
} from "@/domains/purchase-orders/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getPurchaseOrder(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updatePurchaseOrder(req, id);
});
