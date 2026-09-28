import { withErrorHandling } from "@/lib/api/http";
import { listAnnotations, createAnnotation } from "@/domains/quality/drawings";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return listAnnotations(req, id);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return createAnnotation(req, id);
});
