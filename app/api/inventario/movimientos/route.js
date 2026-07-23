import { withErrorHandling } from "@/lib/api/http";
import { listMovements } from "@/domains/inventory/service";

export const GET = withErrorHandling((req) => listMovements(req));
