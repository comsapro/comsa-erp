import { withErrorHandling } from "@/lib/api/http";
import { getReceipt } from "@/domains/purchase-receipts/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getReceipt(req, id);
});
