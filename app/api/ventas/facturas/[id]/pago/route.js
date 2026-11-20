import { withErrorHandling } from "@/lib/api/http";
import { registerInvoicePayment } from "@/domains/kpis/invoices";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return registerInvoicePayment(req, id);
});
