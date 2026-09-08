import { withErrorHandling } from "@/lib/api/http";
import { listSalesGoals, createSalesGoal } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listSalesGoals(req));
export const POST = withErrorHandling((req) => createSalesGoal(req));
