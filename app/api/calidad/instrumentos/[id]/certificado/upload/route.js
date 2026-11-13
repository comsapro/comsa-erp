import { withErrorHandling } from "@/lib/api/http";
import { handleInstrumentCalibrationUpload } from "@/domains/quality/instrument-calibration-upload";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return handleInstrumentCalibrationUpload(req, id);
});
