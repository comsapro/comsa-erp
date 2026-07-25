import { withErrorHandling } from "@/lib/api/http";
import { getClientProfile } from "@/domains/clients/service";

export const GET = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return getClientProfile(req, id);
});
