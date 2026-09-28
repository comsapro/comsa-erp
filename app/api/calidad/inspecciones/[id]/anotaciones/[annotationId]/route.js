import { withErrorHandling } from "@/lib/api/http";
import {
  updateAnnotation,
  deleteAnnotation,
} from "@/domains/quality/drawings";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, annotationId } = await ctx.params;
  return updateAnnotation(req, id, annotationId);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, annotationId } = await ctx.params;
  return deleteAnnotation(req, id, annotationId);
});
