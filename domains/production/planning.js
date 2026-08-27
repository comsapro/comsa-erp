import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnyPermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ConflictError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { updateItemPlanningSchema, assignProcessSchema, updateOrderPlanningSchema } from "./schemas";
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

export async function updateOrderPlanning(request, orderId) {
  await requirePermission("production.manage_planning");
  const actor = await getActor(request);
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden esta cancelada");
  }

  const data = updateOrderPlanningSchema.parse(await request.json());
  const next = {
    updatedBy: actor.id,
  };
  if (data.estimatedDeliveryDate !== undefined) {
    next.estimatedDeliveryDate = asDate(data.estimatedDeliveryDate);
  }

  const updated = await prisma.productionOrder.update({
    where: { id: orderId },
    data: next,
    include: getDetailInclude(),
  });

  await recordProductionActivity(prisma, {
    type: "PLANNING",
    productionOrderId: orderId,
    body: `Fecha de entrega aproximada actualizada${
      data.reason ? `: ${data.reason}` : ""
    }`,
    payload: {
      previous: { estimatedDeliveryDate: order.estimatedDeliveryDate },
      next: { estimatedDeliveryDate: next.estimatedDeliveryDate },
    },
    createdBy: actor.id,
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { estimatedDeliveryDate: order.estimatedDeliveryDate },
    newData: next,
  });

  return jsonOk(updated);
}

export async function listSchedule(request) {
  await requirePermission("production.view");
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const assignedTo = url.searchParams.get("assignedToUserId");
  const clientId = url.searchParams.get("clientId");
  const sellerId = url.searchParams.get("sellerId");
  const status = url.searchParams.get("status");
  const orderStatus = url.searchParams.get("orderStatus");
  const processId = url.searchParams.get("processId");
  const processName = url.searchParams.get("processName");
  const datedOnly = url.searchParams.get("datedOnly") === "1";
  // from/to definen la ventana del tablero. Sin datedOnly tambien se incluyen
  // partidas sin ninguna fecha (aparecen en lista pero sin barra).
  const andClauses = [];
  if (from || to) {
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    const inWindow = {
      OR: [
        { plannedStartAt: range },
        { plannedEndAt: range },
        { commitmentDate: range },
        { productionOrder: { estimatedDeliveryDate: range } },
      ],
    };
    if (datedOnly) {
      andClauses.push(inWindow);
    } else {
      andClauses.push({
        OR: [
          ...inWindow.OR,
          {
            AND: [
              { plannedStartAt: null },
              { plannedEndAt: null },
              { commitmentDate: null },
              { productionOrder: { estimatedDeliveryDate: null } },
            ],
          },
        ],
      });
    }
  } else if (datedOnly) {
    andClauses.push({
      OR: [
        { plannedStartAt: { not: null } },
        { plannedEndAt: { not: null } },
        { commitmentDate: { not: null } },
        { productionOrder: { estimatedDeliveryDate: { not: null } } },
      ],
    });
  }

  const processWhere = { status: { not: "REPLACED" } };
  if (processId) processWhere.manufacturingProcessId = processId;
  if (processName) {
    processWhere.processNameSnapshot = {
      contains: processName,
      mode: "insensitive",
    };
  }

  const rows = await prisma.productionItem.findMany({
    where: {
      status: status || { not: "CANCELLED" },
      productionOrder: {
        status: orderStatus || { not: "CANCELLED" },
        ...(clientId ? { clientId } : {}),
        ...(sellerId
          ? {
              OR: [
                { quote: { sellerId } },
                { directOrder: { sellerId } },
              ],
            }
          : {}),
      },
      ...(assignedTo ? { assignedToUserId: assignedTo } : {}),
      ...(processId || processName
        ? { processes: { some: processWhere } }
        : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
    },
    orderBy: [
      { plannedStartAt: "asc" },
      { commitmentDate: "asc" },
      { position: "asc" },
    ],
    include: {
      assignedToUser: { select: { id: true, name: true } },
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          estimatedDeliveryDate: true,
          client: { select: { id: true, commercialName: true } },
          quote: {
            select: {
              id: true,
              folio: true,
              seller: { select: { id: true, name: true } },
            },
          },
          directOrder: {
            select: {
              id: true,
              folio: true,
              seller: { select: { id: true, name: true } },
            },
          },
        },
      },
      processes: {
        where: { status: { not: "REPLACED" } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          processNameSnapshot: true,
          manufacturingProcessId: true,
          quotedHours: true,
          expectedHours: true,
          realHours: true,
          status: true,
          sortOrder: true,
        },
      },
    },
    take: 500,
  });

  const enriched = rows.map((row) => {
    const processes = row.processes || [];
    const nextProcess =
      processes.find((p) => p.status === "PENDING") ||
      (processes.length
        ? processes.every((p) => p.status === "COMPLETED")
          ? processes[processes.length - 1]
          : null
        : null);
    return {
      ...row,
      currentStage: nextProcess
        ? {
            id: nextProcess.id,
            name: nextProcess.processNameSnapshot,
            status: nextProcess.status,
          }
        : null,
      processNames: processes.map((p) => p.processNameSnapshot),
    };
  });

  return jsonOk(enriched);
}
