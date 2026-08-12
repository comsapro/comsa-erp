import { withErrorHandling } from "@/lib/api/http";
import { handleProductionAttachmentUpload } from "@/domains/production/attachments";

/**
 * Token de client-upload para Vercel Blob (hasta 50 MB).
 * Usado por `upload()` de `@vercel/blob/client`.
 */
export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return handleProductionAttachmentUpload(req, id);
});
