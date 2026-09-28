import { withErrorHandling } from "@/lib/api/http";
import { createExternalShare } from "@/domains/quality/service";

export const POST = withErrorHandling(async (req) => createExternalShare(req));
