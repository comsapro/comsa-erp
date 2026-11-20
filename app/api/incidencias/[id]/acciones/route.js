import { withErrorHandling } from "@/lib/api/http";
import { incidentAction } from "@/domains/kpis/incidents";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return incidentAction(req, id);
});
