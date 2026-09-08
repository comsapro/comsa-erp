import { withErrorHandling } from "@/lib/api/http";
import { listSalesCommitments } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listSalesCommitments(req));
