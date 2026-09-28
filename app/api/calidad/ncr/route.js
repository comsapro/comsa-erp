import { withErrorHandling } from "@/lib/api/http";
import { recordNcr, requestMissingProcess } from "@/domains/quality/service";

export const POST = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "ncr";
  if (action === "missing-process") return requestMissingProcess(req);
  return recordNcr(req);
});
