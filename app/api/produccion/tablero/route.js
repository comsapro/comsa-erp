import { withErrorHandling } from "@/lib/api/http";
import { getProductionDashboard } from "@/domains/production/dashboard";

export const GET = withErrorHandling((req) => getProductionDashboard(req));
