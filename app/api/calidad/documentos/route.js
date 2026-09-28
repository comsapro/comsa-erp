import { withErrorHandling } from "@/lib/api/http";
import { createQualityDocument } from "@/domains/quality/documents";

export const POST = withErrorHandling((req) => createQualityDocument(req));
