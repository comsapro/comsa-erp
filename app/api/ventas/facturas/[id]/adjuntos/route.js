import { withErrorHandling } from "@/lib/api/http";
import { registerInvoiceFile } from "@/domains/sales/invoice-attachments";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return registerInvoiceFile(req, id);
});
