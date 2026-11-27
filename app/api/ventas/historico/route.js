import { withErrorHandling } from "@/lib/api/http";
import { listSalesHistory } from "@/domains/sales/history";

export const GET = withErrorHandling((req) => listSalesHistory(req));
