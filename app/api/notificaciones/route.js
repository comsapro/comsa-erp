import { withErrorHandling } from "@/lib/api/http";
import { listMyNotifications } from "@/domains/notifications/service";

export const GET = withErrorHandling((req) => listMyNotifications(req));
