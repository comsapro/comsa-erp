import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getCurrentUser, userHasPermission } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { getDetailInclude } from "./recalc";
import {
  findUserOpenSession,
  nextPendingProcess,
  resolveScanSessionAction,
} from "./process-rules";
import { startSession, pauseSession, resumeSession, endSession } from "./sessions";

async function loadItemContext(orderId, itemId) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Partida no encontrada");
  const process = nextPendingProcess(item.processes || []);
  return { order, item, process };
}

function mapScanPayload({ order, item, process }, actor) {
  const session = process ? findUserOpenSession(process, actor.id) : null;
  const suggested = process
    ? resolveScanSessionAction(process, actor.id)
    : { action: null, reason: "no_process" };
  const canRecord = userHasPermission(actor, "production.record_sessions");

  return {
    order: {
      id: order.id,
      folio: order.folio,
      status: order.status,
      clientName: order.client?.commercialName || null,
    },
    item: {
      id: item.id,
      position: item.position,
      description: item.description,
      status: item.status,
      quantity: Number(item.quantity) || 0,
      completedQuantity: Number(item.completedQuantity) || 0,
    },
    process: process
      ? {
          id: process.id,
          name: process.processNameSnapshot,
          status: process.status,
        }
      : null,
    session: session
      ? {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
        }
      : null,
    suggestedAction: suggested.action,
    canRecord,
  };
}

export async function getScanContext(request, orderId, itemId) {
  await requirePermission("production.view");
  const user = await getCurrentUser();
  const ctx = await loadItemContext(orderId, itemId);
  return jsonOk(mapScanPayload(ctx, user));
}

export async function applyScanAction(request, orderId, itemId) {
  await requirePermission("production.record_sessions");
  const user = await getCurrentUser();
  const ctx = await loadItemContext(orderId, itemId);
  const { process } = ctx;
  if (!process) {
    return jsonOk({
      ...mapScanPayload(ctx, user),
      message: "No hay proceso pendiente en esta partida",
    });
  }

  const body = await request.json().catch(() => ({}));
  let action = body.action;
  if (!action) {
    action = resolveScanSessionAction(process, user.id).action;
  }

  const processId = process.id;
  if (action === "start") return startSession(request, orderId, itemId, processId);
  if (action === "pause") return pauseSession(request, orderId, itemId, processId);
  if (action === "resume") return resumeSession(request, orderId, itemId, processId);
  if (action === "end") return endSession(request, orderId, itemId, processId);

  return jsonOk({
    ...mapScanPayload(ctx, user),
    message: "No hay accion disponible",
  });
}
