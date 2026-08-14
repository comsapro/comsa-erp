import { withErrorHandling } from "@/lib/api/http";
import {
  dimensionalControlPdf,
  requireItemId,
} from "@/domains/production/documents";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  const itemId = await requireItemId(new URL(req.url).searchParams);
  return dimensionalControlPdf(req, id, itemId);
});
