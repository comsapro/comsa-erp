import { withErrorHandling } from "@/lib/api/http";
import { replaceTeamRoles } from "@/domains/teams/service";

export const PUT = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return replaceTeamRoles(req, id);
});
