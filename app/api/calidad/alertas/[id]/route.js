import { withErrorHandling } from "@/lib/api/http";
import { updateAlert } from "@/domains/quality/service";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateAlert(req, id);
});
