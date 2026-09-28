import { withErrorHandling } from "@/lib/api/http";
import {
  startInspection,
  completeInspection,
} from "@/domains/quality/drawings";
import { NotFoundError } from "@/lib/permissions/errors";

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  if (action === "start") return startInspection(req, id);
  if (action === "complete") return completeInspection(req, id);
  if (action === "reject") {
    const body = await req.json().catch(() => ({}));
    const wrapped = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ ...body, result: "REJECTED" }),
    });
    return completeInspection(wrapped, id);
  }
  throw new NotFoundError("Accion no encontrada");
});
