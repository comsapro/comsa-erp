import { withErrorHandling } from "@/lib/api/http";
import { getExternalShare } from "@/domains/quality/service";

export const GET = withErrorHandling(async (_req, ctx) => {
  const { token } = await ctx.params;
  return getExternalShare(token);
});
