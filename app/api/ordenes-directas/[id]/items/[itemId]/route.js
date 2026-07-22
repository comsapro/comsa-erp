import { withErrorHandling } from "@/lib/api/http";
import { deleteDirectOrderItem } from "@/domains/direct-orders/service";

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return deleteDirectOrderItem(req, id, itemId);
});
