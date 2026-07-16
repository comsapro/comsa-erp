import { withErrorHandling } from "@/lib/api/http";
import { getRole, updateRole, removeRole } from "@/domains/roles/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getRole(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateRole(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return removeRole(req, id);
});
