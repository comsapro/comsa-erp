import { withErrorHandling } from "@/lib/api/http";
import { listReceivedMaterials } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listReceivedMaterials(req));
