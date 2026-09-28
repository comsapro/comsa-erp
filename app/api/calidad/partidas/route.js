import { withErrorHandling } from "@/lib/api/http";
import { listQualityItems } from "@/domains/quality/drawings";

export const GET = withErrorHandling((req) => listQualityItems(req));
