import { withErrorHandling } from "@/lib/api/http";
import { replaceTeamMembers } from "@/domains/teams/service";

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return replaceTeamMembers(req, id);
});
