import { withErrorHandling } from "@/lib/api/http";
import {
  deleteSalesCalendarEvent,
  updateSalesCalendarEvent,
} from "@/domains/sales/calendar-events";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return updateSalesCalendarEvent(req, id);
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  const { id } = await ctx.params;
  return deleteSalesCalendarEvent(req, id);
});
