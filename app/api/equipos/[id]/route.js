import { withErrorHandling } from "@/lib/api/http";
import { getTeam, updateTeam, removeTeam } from "@/domains/teams/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getTeam(req, id);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateTeam(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return removeTeam(req, id);
});
