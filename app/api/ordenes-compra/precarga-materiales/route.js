import { withErrorHandling } from "@/lib/api/http";
import { listPreloadMaterials } from "@/domains/purchase-orders/service";

export const GET = withErrorHandling((req) => listPreloadMaterials(req));
