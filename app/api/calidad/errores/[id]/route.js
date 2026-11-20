import { withErrorHandling } from "@/lib/api/http";
import { getQualityError, updateQualityError, deleteQualityError } from "@/domains/quality/errors";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getQualityError(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateQualityError(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return deleteQualityError(req, id);
});
