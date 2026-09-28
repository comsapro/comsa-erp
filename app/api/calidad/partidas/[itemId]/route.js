import { withErrorHandling } from "@/lib/api/http";
import {
  updateQuantities,
  configureSampling,
  ensurePieces,
  startInspection,
  releaseFirstPiece,
} from "@/domains/quality/service";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const { itemId } = await ctx.params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "quantities";
  if (action === "sampling") return configureSampling(req, itemId);
  if (action === "pieces") return ensurePieces(req, itemId);
  if (action === "start-inspection") return startInspection(req, itemId);
  if (action === "release-first-piece") return releaseFirstPiece(req, itemId);
  return updateQuantities(req, itemId);
});

export const POST = withErrorHandling(async (req, ctx) => {
  const { itemId } = await ctx.params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "pieces";
  if (action === "pieces") return ensurePieces(req, itemId);
  if (action === "start-inspection") return startInspection(req, itemId);
  if (action === "release-first-piece") return releaseFirstPiece(req, itemId);
  if (action === "sampling") return configureSampling(req, itemId);
  return updateQuantities(req, itemId);
});
