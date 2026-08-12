import { withErrorHandling } from "@/lib/api/http";
import { deleteProductionAttachment } from "@/domains/production/attachments";

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, attachmentId } = await ctx.params;
  return deleteProductionAttachment(req, id, attachmentId);
});
