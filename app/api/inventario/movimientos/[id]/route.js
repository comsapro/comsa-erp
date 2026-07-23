import { withErrorHandling } from "@/lib/api/http";
import { getMovement } from "@/domains/inventory/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getMovement(req, id);
});
