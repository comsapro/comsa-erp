import { withErrorHandling } from "@/lib/api/http";
import {
  getTemplate,
  updateTemplate,
  removeTemplate,
} from "@/domains/quote-templates/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getTemplate(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateTemplate(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return removeTemplate(req, id);
});
