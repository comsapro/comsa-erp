import { withErrorHandling } from "@/lib/api/http";
import { listInspections, createInspection } from "@/domains/quality/drawings";

export const GET = withErrorHandling((req) => listInspections(req));
export const POST = withErrorHandling((req) => createInspection(req));
