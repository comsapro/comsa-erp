import { withErrorHandling } from "@/lib/api/http";
import { getSupplierProfile } from "@/domains/suppliers/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getSupplierProfile(req, id);
});
