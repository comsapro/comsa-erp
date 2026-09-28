import { withErrorHandling } from "@/lib/api/http";
import { registerEvidence } from "@/domains/quality/service";

export const POST = withErrorHandling(async (req) => registerEvidence(req));
