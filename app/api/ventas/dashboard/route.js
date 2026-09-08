import { withErrorHandling } from "@/lib/api/http";
import { getSalesDashboard } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => getSalesDashboard(req));
