import { withErrorHandling } from "@/lib/api/http";
import { purchasesReportPdf } from "@/domains/reports/service";

export const GET = withErrorHandling((req) => purchasesReportPdf(req));
