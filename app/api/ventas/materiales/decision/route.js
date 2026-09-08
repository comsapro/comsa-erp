import { withErrorHandling } from "@/lib/api/http";
import { upsertMaterialDecision } from "@/domains/sales/service";

export const POST = withErrorHandling((req) => upsertMaterialDecision(req));
