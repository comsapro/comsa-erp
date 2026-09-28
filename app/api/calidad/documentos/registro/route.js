import { withErrorHandling } from "@/lib/api/http";
import { registerQualityUpload } from "@/domains/quality/documents";

export const POST = withErrorHandling((req) => registerQualityUpload(req));
