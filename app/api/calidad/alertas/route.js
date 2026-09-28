import { withErrorHandling } from "@/lib/api/http";
import { listAlerts, updateAlert } from "@/domains/quality/service";

export const GET = withErrorHandling(async (req) => listAlerts(req));
