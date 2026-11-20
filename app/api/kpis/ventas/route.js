import { withErrorHandling } from "@/lib/api/http";
import { getSalesHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getSalesHandler(req));
