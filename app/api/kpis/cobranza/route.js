import { withErrorHandling } from "@/lib/api/http";
import { getCollectionHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getCollectionHandler(req));
