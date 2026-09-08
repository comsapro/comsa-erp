import { withErrorHandling } from "@/lib/api/http";
import { listPendingReceiptMaterials } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listPendingReceiptMaterials(req));
