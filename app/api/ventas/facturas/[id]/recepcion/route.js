import { withErrorHandling } from "@/lib/api/http";
import { markSalesInvoiceReception } from "@/domains/sales/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return markSalesInvoiceReception(req, id);
});
