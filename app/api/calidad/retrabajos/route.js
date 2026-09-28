import { withErrorHandling } from "@/lib/api/http";
import {
  createReworkOrder,
  createReworkSimple,
} from "@/domains/quality/service";

export const POST = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "order";
  if (action === "simple") return createReworkSimple(req);
  return createReworkOrder(req);
});
