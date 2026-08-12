import { withErrorHandling } from "@/lib/api/http";
import { getRelatedQuotePdf } from "@/domains/production/attachments";

/** PDF de la cotizacion origen ligada a la orden de produccion. */
export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getRelatedQuotePdf(req, id);
});
