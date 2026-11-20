import { withErrorHandling } from "@/lib/api/http";
import { unreadSummary } from "@/domains/notifications/service";

export const GET = withErrorHandling(() => unreadSummary());
