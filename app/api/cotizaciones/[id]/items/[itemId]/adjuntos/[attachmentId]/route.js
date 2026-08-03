import { withErrorHandling } from "@/lib/api/http";
import { deleteItemAttachment } from "@/domains/quotes/attachments";

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, itemId, attachmentId } = await ctx.params;
  return deleteItemAttachment(req, id, itemId, attachmentId);
});
