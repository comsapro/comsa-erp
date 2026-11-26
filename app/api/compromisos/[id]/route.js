import { withErrorHandling } from "@/lib/api/http";
import { getCommitment, updateCommitment } from "@/domains/commitments/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getCommitment(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateCommitment(req, id);
});
