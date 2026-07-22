import { withErrorHandling } from "@/lib/api/http";
import { listProduction } from "@/domains/production/service";

export const GET = withErrorHandling((req) => listProduction(req));
