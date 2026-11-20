import { withErrorHandling } from "@/lib/api/http";
import { getQualityHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getQualityHandler(req));
