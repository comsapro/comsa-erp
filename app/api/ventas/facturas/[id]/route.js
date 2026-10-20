import { withErrorHandling } from "@/lib/api/http";
import {
  getSalesInvoice,
  updateSalesInvoice,
} from "@/domains/sales/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getSalesInvoice(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateSalesInvoice(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateSalesInvoice(req, id);
});
