import { withErrorHandling } from "@/lib/api/http";
import {
  updateProcessHours,
  deleteProductionProcess,
} from "@/domains/production/processes";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id, itemId, processId } = await ctx.params;
  return updateProcessHours(req, id, itemId, processId);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id, itemId, processId } = await ctx.params;
  return deleteProductionProcess(req, id, itemId, processId);
});
