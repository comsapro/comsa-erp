import { withErrorHandling } from "@/lib/api/http";
import { listStock } from "@/domains/inventory/service";

export const GET = withErrorHandling((req) => listStock(req));
