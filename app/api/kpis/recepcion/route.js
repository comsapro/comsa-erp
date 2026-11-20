import { withErrorHandling } from "@/lib/api/http";
import { getReceptionHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getReceptionHandler(req));
