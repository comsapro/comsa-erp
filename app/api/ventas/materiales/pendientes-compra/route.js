import { withErrorHandling } from "@/lib/api/http";
import { listPendingPurchaseMaterials } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listPendingPurchaseMaterials(req));
