import { withErrorHandling } from "@/lib/api/http";
import { upsertDirectOrderItem } from "@/domains/direct-orders/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return upsertDirectOrderItem(req, id);
});
