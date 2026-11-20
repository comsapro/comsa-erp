import { withErrorHandling } from "@/lib/api/http";
import { getSummaryHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getSummaryHandler(req));
