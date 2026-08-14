import { withErrorHandling } from "@/lib/api/http";
import {
  workOrderPdf,
  requireItemId,
} from "@/domains/production/documents";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  const itemId = await requireItemId(new URL(req.url).searchParams);
  return workOrderPdf(req, id, itemId);
});
