import { withErrorHandling } from "@/lib/api/http";
import { getIncident } from "@/domains/kpis/incidents";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getIncident(req, id);
});
