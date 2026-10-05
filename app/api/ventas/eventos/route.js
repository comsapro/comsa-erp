import { withErrorHandling } from "@/lib/api/http";
import {
  createSalesCalendarEvent,
  listSalesCalendarEvents,
} from "@/domains/sales/calendar-events";

export const GET = withErrorHandling((req) => listSalesCalendarEvents(req));
export const POST = withErrorHandling((req) => createSalesCalendarEvent(req));
