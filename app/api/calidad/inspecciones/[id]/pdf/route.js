import { withErrorHandling } from "@/lib/api/http";
import { inspectionReportPdf } from "@/domains/quality/pdf";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return inspectionReportPdf(req, id);
});
