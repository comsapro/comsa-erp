import { withErrorHandling } from "@/lib/api/http";
import { getCommitmentsHandler } from "@/domains/kpis/service";

export const GET = withErrorHandling((req) => getCommitmentsHandler(req));
