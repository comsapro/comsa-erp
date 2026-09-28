import { withErrorHandling } from "@/lib/api/http";
import { addReworkHours } from "@/domains/quality/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return addReworkHours(req, id);
});
