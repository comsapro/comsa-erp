import { withErrorHandling } from "@/lib/api/http";
import { closeInspection } from "@/domains/quality/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return closeInspection(req, id);
});
