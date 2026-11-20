import { withErrorHandling } from "@/lib/api/http";
import { exportReportHandler } from "@/domains/kpis/export";

export const GET = withErrorHandling((req) => exportReportHandler(req));
