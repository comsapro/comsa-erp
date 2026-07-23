import { withErrorHandling } from "@/lib/api/http";
import { createExit } from "@/domains/inventory/service";

export const POST = withErrorHandling((req) => createExit(req));
