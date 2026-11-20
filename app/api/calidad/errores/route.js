import { withErrorHandling } from "@/lib/api/http";
import { listQualityErrors, createQualityError } from "@/domains/quality/errors";

export const GET = withErrorHandling((req) => listQualityErrors(req));
export const POST = withErrorHandling((req) => createQualityError(req));
