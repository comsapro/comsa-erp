import { withErrorHandling } from "@/lib/api/http";
import { listLowStock } from "@/domains/inventory/service";

export const GET = withErrorHandling((req) => listLowStock(req));
