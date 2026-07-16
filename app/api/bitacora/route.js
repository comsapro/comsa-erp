import { withErrorHandling } from "@/lib/api/http";
import { listAuditLogs } from "@/domains/audit/service";

export const GET = withErrorHandling((req) => listAuditLogs(req));
