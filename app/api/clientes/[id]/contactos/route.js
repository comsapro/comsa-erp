import { withErrorHandling } from "@/lib/api/http";
import { addClientContact } from "@/domains/clients/service";

export const POST = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  return addClientContact(request, id);
});
