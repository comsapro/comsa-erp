import { withErrorHandling } from "@/lib/api/http";
import { listItemQualityDocuments } from "@/domains/quality/documents";

export const GET = withErrorHandling(async (req, ctx) => {
  const { itemId } = await ctx.params;
  return listItemQualityDocuments(req, itemId);
});
