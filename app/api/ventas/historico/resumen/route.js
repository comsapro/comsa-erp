import { withErrorHandling } from "@/lib/api/http";
import { getSalesHistorySummary } from "@/domains/sales/history";

export const GET = withErrorHandling((req) => getSalesHistorySummary(req));
