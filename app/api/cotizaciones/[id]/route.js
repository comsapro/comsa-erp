import { withErrorHandling } from "@/lib/api/http";
import {
  getQuote,
  updateQuote,
  removeQuote,
} from "@/domains/quotes/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getQuote(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateQuote(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return removeQuote(req, id);
});
