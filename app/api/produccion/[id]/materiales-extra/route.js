import { withErrorHandling } from "@/lib/api/http";
import {
  listExtraMaterials,
  createExtraMaterial,
} from "@/domains/production/extra-materials";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return listExtraMaterials(req, id);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return createExtraMaterial(req, id);
});
