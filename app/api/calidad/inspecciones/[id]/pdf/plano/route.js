import { withErrorHandling } from "@/lib/api/http";
import { annotatedDrawingPdf } from "@/domains/quality/pdf";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return annotatedDrawingPdf(req, id);
});
