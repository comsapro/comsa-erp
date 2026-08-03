import { withErrorHandling } from "@/lib/api/http";
import { handleItemAttachmentUpload } from "@/domains/quotes/attachments";

/**
 * Token de client-upload para Vercel Blob (hasta 50 MB).
 * Usado por `upload()` de `@vercel/blob/client`.
 */
export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return handleItemAttachmentUpload(req, id, itemId);
});
