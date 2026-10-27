import { withErrorHandling } from "@/lib/api/http";
import { handleQualityEvidenceUpload } from "@/domains/quality/evidence-upload";

export const POST = withErrorHandling((req) => handleQualityEvidenceUpload(req));
