import { withErrorHandling } from "@/lib/api/http";
import { updateInstrument, addCalibration } from "@/domains/quality/service";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateInstrument(req, id);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return addCalibration(req, id);
});
