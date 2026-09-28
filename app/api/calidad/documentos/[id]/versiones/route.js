import { withErrorHandling } from "@/lib/api/http";
import { createQualityDocumentVersion } from "@/domains/quality/documents";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return createQualityDocumentVersion(req, id);
});
