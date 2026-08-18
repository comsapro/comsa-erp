import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnyPermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ConflictError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { updateItemPlanningSchema, assignProcessSchema } from "./schemas";
import { recordProductionActivity } from "./activity";
import { getDetailInclude } from "./recalc";

function asDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function updateItemPlanning(request, orderId, itemId) {
  await requireAnyPermission([
    "production.manage_planning",
    "production.assign_responsible",
  ]);
  const actor = await getActor(request);
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Partida no encontrada");
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden esta cancelada");
  }

  const data = updateItemPlanningSchema.parse(await request.json());
  const next = {
    updatedBy: actor.id,
  };
  if (data.assignedToUserId !== undefined) {
    next.assignedToUserId = data.assignedToUserId;
  }
  if (data.priority) next.priority = data.priority;
  if (data.plannedStartAt !== undefined) next.plannedStartAt = asDate(data.plannedStartAt);
  if (data.plannedEndAt !== undefined) next.plannedEndAt = asDate(data.plannedEndAt);
  if (data.commitmentDate !== undefined) next.commitmentDate = asDate(data.commitmentDate);

  const datesChanged =
    data.plannedStartAt !== undefined ||
    data.plannedEndAt !== undefined ||
    data.commitmentDate !== undefined;

  await prisma.$transaction(async (tx) => {
    await tx.productionItem.update({ where: { id: itemId }, data: next });
    if (datesChanged) {
      await tx.productionScheduleChange.create({
        data: {
          productionItemId: itemId,
          previousPlannedStartAt: item.plannedStartAt,
          previousPlannedEndAt: item.plannedEndAt,
          previousCommitmentDate: item.commitmentDate,
          newPlannedStartAt: next.plannedStartAt ?? item.plannedStartAt,
          newPlannedEndAt: next.plannedEndAt ?? item.plannedEndAt,
          newCommitmentDate: next.commitmentDate ?? item.commitmentDate,
          reason: data.reason || "Reprogramacion",
          createdBy: actor.id,
        },
      });
    }
    await recordProductionActivity(tx, {
      type: datesChanged ? "PLANNING" : "STATUS",
      productionOrderId: orderId,
      productionItemId: itemId,
      body: datesChanged
        ? `Reprogramacion${data.reason ? `: ${data.reason}` : ""}`
        : "Datos de ejecucion actualizados",
      payload: {
        previous: {
          assignedToUserId: item.assignedToUserId,
          priority: item.priority,
          plannedStartAt: item.plannedStartAt,
          plannedEndAt: item.plannedEndAt,
          commitmentDate: item.commitmentDate,
        },
        next,
      },
      createdBy: actor.id,
    });
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionItem",
    entityId: itemId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: {
      assignedToUserId: item.assignedToUserId,
      priority: item.priority,
    },
    newData: next,
  });

  return jsonOk(
    await prisma.productionOrder.findFirst({
      where: { id: orderId },
      include: getDetailInclude(),
    })
  );
}

export async function assignProcessResponsible(request, orderId, itemId, processId) {
  await requirePermission("production.assign_responsible");
  const actor = await getActor(request);
  const process = await prisma.productionItemProcess.findFirst({
    where: { id: processId, productionItemId: itemId },
  });
  if (!process) throw new NotFoundError("Proceso no encontrado");
  const data = assignProcessSchema.parse(await request.json());
  await prisma.productionItemProcess.update({
    where: { id: processId },
    data: { assignedToUserId: data.assignedToUserId || null, updatedBy: actor.id },
  });
  await recordProductionActivity(prisma, {
    type: "PROCESS_CHANGE",
    productionOrderId: orderId,
    productionItemId: itemId,
    processId,
    body: "Responsable de proceso actualizado",
    payload: {
      previous: process.assignedToUserId,
      next: data.assignedToUserId || null,
    },
    createdBy: actor.id,
  });
  return jsonOk(
    await prisma.productionOrder.findFirst({
      where: { id: orderId },
      include: getDetailInclude(),
    })
  );
}

export async function listSchedule(request) {
  await requirePermission("production.view");
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const assignedTo = url.searchParams.get("assignedToUserId");

  const dateFilter = {};
  if (from || to) {
    dateFilter.OR = [
      {
        plannedStartAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      {
        plannedEndAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      {
        commitmentDate: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
    ].map((clause) => {
      const key = Object.keys(clause)[0];
      const range = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      return { [key]: range };
    });
  }

  const rows = await prisma.productionItem.findMany({
    where: {
      status: { not: "CANCELLED" },
      productionOrder: { status: { not: "CANCELLED" } },
      ...(assignedTo ? { assignedToUserId: assignedTo } : {}),
      ...dateFilter,
    },
    orderBy: [{ plannedStartAt: "asc" }, { commitmentDate: "asc" }, { position: "asc" }],
    include: {
      assignedToUser: { select: { id: true, name: true } },
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          client: { select: { commercialName: true } },
        },
      },
      processes: {
        where: { status: { not: "REPLACED" } },
        select: { quotedHours: true, expectedHours: true, realHours: true, status: true },
      },
    },
    take: 500,
  });

  return jsonOk(rows);
}
