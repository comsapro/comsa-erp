import { withErrorHandling } from "@/lib/api/http";
import {
  listProductionAttachments,
  registerProductionAttachment,
} from "@/domains/production/attachments";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return listProductionAttachments(req, id);
});

/** Registra metadata tras client upload a Vercel Blob. */
export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return registerProductionAttachment(req, id);
});
