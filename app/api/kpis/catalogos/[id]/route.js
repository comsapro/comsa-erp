import { withErrorHandling } from "@/lib/api/http";
import { updateCatalogEntry, deleteCatalogEntry } from "@/domains/kpis/settings";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateCatalogEntry(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return deleteCatalogEntry(req, id);
});
