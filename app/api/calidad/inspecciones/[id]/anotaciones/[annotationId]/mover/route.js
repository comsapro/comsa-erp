import { withErrorHandling } from "@/lib/api/http";
import { moveAnnotation } from "@/domains/quality/drawings";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, annotationId } = await ctx.params;
  return moveAnnotation(req, id, annotationId);
});
