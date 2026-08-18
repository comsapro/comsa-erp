import { withErrorHandling } from "@/lib/api/http";
import { listSchedule } from "@/domains/production/planning";

export const GET = withErrorHandling((req) => listSchedule(req));
