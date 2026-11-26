import { withErrorHandling } from "@/lib/api/http";
import { commitmentAction } from "@/domains/commitments/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return commitmentAction(req, id);
});
