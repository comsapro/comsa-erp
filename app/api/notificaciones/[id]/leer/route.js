import { withErrorHandling } from "@/lib/api/http";
import { markNotificationRead } from "@/domains/notifications/service";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return markNotificationRead(req, id);
});
