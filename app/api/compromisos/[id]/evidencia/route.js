import { withErrorHandling } from "@/lib/api/http";
import { handleEvidenceUpload } from "@/domains/commitments/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return handleEvidenceUpload(req, id);
});
