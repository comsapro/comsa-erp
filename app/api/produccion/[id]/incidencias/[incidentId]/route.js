import { withErrorHandling } from "@/lib/api/http";
import { updateIncident } from "@/domains/production/incidents";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, incidentId } = await ctx.params;
  return updateIncident(req, id, incidentId);
});
