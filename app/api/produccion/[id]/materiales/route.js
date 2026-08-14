import { withErrorHandling } from "@/lib/api/http";
import { listProductionMaterials } from "@/domains/production/materials";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return listProductionMaterials(req, id);
});
