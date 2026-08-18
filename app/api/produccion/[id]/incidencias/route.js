import { withErrorHandling } from "@/lib/api/http";
import {
  listIncidents,
  createIncident,
} from "@/domains/production/incidents";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return listIncidents(req, id);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return createIncident(req, id);
});
