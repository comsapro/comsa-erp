import { withErrorHandling } from "@/lib/api/http";
import { quotationsReportPdf } from "@/domains/reports/service";

export const GET = withErrorHandling((req) => quotationsReportPdf(req));
