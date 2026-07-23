import { withErrorHandling } from "@/lib/api/http";
import { inventoryReportPdf } from "@/domains/reports/service";

export const GET = withErrorHandling((req) => inventoryReportPdf(req));
