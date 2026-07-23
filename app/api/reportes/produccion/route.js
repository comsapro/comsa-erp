import { withErrorHandling } from "@/lib/api/http";
import { productionReportPdf } from "@/domains/reports/service";

export const GET = withErrorHandling((req) => productionReportPdf(req));
