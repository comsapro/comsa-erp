import { withErrorHandling } from "@/lib/api/http";
import { listPendingInbox } from "@/domains/quality/service";

export const GET = withErrorHandling(async (req) => listPendingInbox(req));
