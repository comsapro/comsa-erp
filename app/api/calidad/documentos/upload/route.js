import { withErrorHandling } from "@/lib/api/http";
import { handleQualityDocumentUpload } from "@/domains/quality/documents";

export const POST = withErrorHandling((req) => handleQualityDocumentUpload(req));
