import { withErrorHandling } from "@/lib/api/http";
import {
  listItemAttachments,
  registerItemAttachment,
} from "@/domains/quotes/attachments";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return listItemAttachments(req, id, itemId);
});

/** Registra metadata tras client upload a Vercel Blob. */
export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  return registerItemAttachment(req, id, itemId);
});
