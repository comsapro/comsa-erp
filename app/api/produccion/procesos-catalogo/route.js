import { withErrorHandling } from "@/lib/api/http";
import { listProcessCatalog } from "@/domains/production/processes";

export const GET = withErrorHandling(async (req) => listProcessCatalog(req));
