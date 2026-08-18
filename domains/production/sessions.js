import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { ConflictError, NotFoundError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { recordProductionActivity } from "./activity";
import { sessionsHours } from "./process-rules";
import { getDetailInclude, recalculateProductionState } from "./recalc";

function toDecimal(n) {
  return new Prisma.Decimal(Math.round((Number(n) || 0) * 1000) / 1000);
}

async function loadProcess(orderId, itemId, processId) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden esta cancelada");
  }
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Partida no encontrada");
  if (item.status === "COMPLETED" || item.status === "CANCELLED") {
    throw new ConflictError("La partida no admite sesiones en este estado");
  }
  const process = (item.processes || []).find((p) => p.id === processId);
  if (!process) throw new NotFoundError("Proceso no encontrado");
  if (process.status === "REPLACED" || process.status === "COMPLETED") {
    throw new ConflictError("El proceso no admite sesiones");
  }
  return { order, item, process };
}

async function syncRealHours(tx, processId) {
  const sessions = await tx.productionTimeSession.findMany({
    where: { processId },
  });
  const hours = sessionsHours(sessions);
  const first = sessions
    .slice()
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
  await tx.productionItemProcess.update({
    where: { id: processId },
    data: {
      realHours: toDecimal(hours),
      startedAt: first?.startedAt || undefined,
    },
  });
  return hours;
}

export async function startSession(request, orderId, itemId, processId) {
  await requirePermission("production.record_sessions");
  const actor = await getActor(request);
  const { order, item, process } = await loadProcess(orderId, itemId, processId);

  const running = await prisma.productionTimeSession.findFirst({
    where: { userId: actor.id, status: "RUNNING" },
  });
  if (running) {
    throw new ConflictError(
      "Ya tienes un proceso en curso. Pausalo o finalizalo antes de iniciar otro."
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.productionTimeSession.create({
      data: {
        productionOrderId: orderId,
        productionItemId: itemId,
        processId,
        userId: actor.id,
        status: "RUNNING",
        startedAt: now,
        lastResumedAt: now,
      },
    });
    if (!process.assignedToUserId) {
      await tx.productionItemProcess.update({
        where: { id: processId },
        data: { assignedToUserId: actor.id, startedAt: process.startedAt || now },
      });
    } else if (!process.startedAt) {
      await tx.productionItemProcess.update({
        where: { id: processId },
        data: { startedAt: now },
      });
    }
    if (item.status === "PENDING") {
      await tx.productionItem.update({
        where: { id: itemId },
        data: { status: "IN_PROGRESS", startedAt: item.startedAt || now },
      });
    }
    await recordProductionActivity(tx, {
      type: "SESSION_START",
      productionOrderId: orderId,
      productionItemId: itemId,
      processId,
      body: `Inicio de sesion en ${process.processNameSnapshot}`,
      createdBy: actor.id,
    });
    await syncRealHours(tx, processId);
    return recalculateProductionState(tx, orderId, actor.id);
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionTimeSession",
    entityId: processId,
    action: AUDIT_ACTIONS.PROGRESS_UPDATE,
    newData: { type: "SESSION_START", folio: order.folio },
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonOk(record);
}

export async function pauseSession(request, orderId, itemId, processId) {
  await requirePermission("production.record_sessions");
  const actor = await getActor(request);
  await loadProcess(orderId, itemId, processId);

  const session = await prisma.productionTimeSession.findFirst({
    where: { processId, userId: actor.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) throw new ConflictError("No hay una sesion activa para pausar");

  const now = new Date();
  const extra =
    (now.getTime() - new Date(session.lastResumedAt).getTime()) / 60000;
  const accumulated = Number(session.accumulatedMinutes) + extra;

  await prisma.$transaction(async (tx) => {
    await tx.productionTimeSession.update({
      where: { id: session.id },
      data: {
        status: "PAUSED",
        pausedAt: now,
        accumulatedMinutes: toDecimal(accumulated),
        durationMinutes: toDecimal(accumulated),
      },
    });
    await recordProductionActivity(tx, {
      type: "SESSION_PAUSE",
      productionOrderId: orderId,
      productionItemId: itemId,
      processId,
      body: "Sesion pausada",
      payload: { minutes: Math.round(accumulated * 1000) / 1000 },
      createdBy: actor.id,
    });
    await syncRealHours(tx, processId);
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonOk(record);
}

export async function resumeSession(request, orderId, itemId, processId) {
  await requirePermission("production.record_sessions");
  const actor = await getActor(request);
  await loadProcess(orderId, itemId, processId);

  const other = await prisma.productionTimeSession.findFirst({
    where: { userId: actor.id, status: "RUNNING" },
  });
  if (other) {
    throw new ConflictError(
      "Ya tienes un proceso en curso. Pausalo antes de reanudar otro."
    );
  }

  const session = await prisma.productionTimeSession.findFirst({
    where: { processId, userId: actor.id, status: "PAUSED" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) throw new ConflictError("No hay una sesion pausada para reanudar");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.productionTimeSession.update({
      where: { id: session.id },
      data: { status: "RUNNING", lastResumedAt: now, pausedAt: null },
    });
    await recordProductionActivity(tx, {
      type: "SESSION_RESUME",
      productionOrderId: orderId,
      productionItemId: itemId,
      processId,
      body: "Sesion reanudada",
      createdBy: actor.id,
    });
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonOk(record);
}

export async function endSession(request, orderId, itemId, processId) {
  await requirePermission("production.record_sessions");
  const actor = await getActor(request);
  const { process } = await loadProcess(orderId, itemId, processId);

  const session = await prisma.productionTimeSession.findFirst({
    where: {
      processId,
      userId: actor.id,
      status: { in: ["RUNNING", "PAUSED"] },
    },
    orderBy: { startedAt: "desc" },
  });
  if (!session) throw new ConflictError("No hay una sesion abierta para finalizar");

  const now = new Date();
  let accumulated = Number(session.accumulatedMinutes) || 0;
  if (session.status === "RUNNING") {
    accumulated +=
      (now.getTime() - new Date(session.lastResumedAt).getTime()) / 60000;
  }

  await prisma.$transaction(async (tx) => {
    await tx.productionTimeSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        endedAt: now,
        accumulatedMinutes: toDecimal(accumulated),
        durationMinutes: toDecimal(accumulated),
      },
    });
    await recordProductionActivity(tx, {
      type: "SESSION_END",
      productionOrderId: orderId,
      productionItemId: itemId,
      processId,
      body: `Sesion finalizada en ${process.processNameSnapshot} (${(accumulated / 60).toFixed(2)} h)`,
      payload: { minutes: Math.round(accumulated * 1000) / 1000 },
      createdBy: actor.id,
    });
    await syncRealHours(tx, processId);
    return recalculateProductionState(tx, orderId, actor.id);
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonOk(record);
}
