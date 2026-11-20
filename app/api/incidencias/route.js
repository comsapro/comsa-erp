import { withErrorHandling } from "@/lib/api/http";
import { listIncidents } from "@/domains/kpis/incidents";

export const GET = withErrorHandling((req) => listIncidents(req));
