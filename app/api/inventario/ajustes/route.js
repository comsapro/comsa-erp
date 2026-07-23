import { withErrorHandling } from "@/lib/api/http";
import { createAdjustment } from "@/domains/inventory/service";

export const POST = withErrorHandling((req) => createAdjustment(req));
