import { withErrorHandling } from "@/lib/api/http";
import { handleInvoiceFileUpload } from "@/domains/sales/invoice-attachments";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return handleInvoiceFileUpload(req, id);
});
