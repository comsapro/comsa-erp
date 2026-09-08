import { withErrorHandling } from "@/lib/api/http";
import { updateCommitmentDate } from "@/domains/sales/service";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateCommitmentDate(req, id);
});
