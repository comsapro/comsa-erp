import { withErrorHandling } from "@/lib/api/http";
import {
  getTransfer,
  updateTransfer,
} from "@/domains/transfers/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getTransfer(req, id);
});

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateTransfer(req, id);
});
