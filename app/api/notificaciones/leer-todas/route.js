import { withErrorHandling } from "@/lib/api/http";
import { markAllNotificationsRead } from "@/domains/notifications/service";

export const POST = withErrorHandling(() => markAllNotificationsRead());
