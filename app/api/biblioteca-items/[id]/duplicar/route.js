import { withErrorHandling } from "@/lib/api/http";
import { duplicateTemplate } from "@/domains/quote-templates/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return duplicateTemplate(req, id);
});
