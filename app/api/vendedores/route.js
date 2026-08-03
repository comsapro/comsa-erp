import { withErrorHandling } from "@/lib/api/http";
import { listSellers } from "@/domains/quotes/sellers";

export const GET = withErrorHandling((req) => listSellers(req));
