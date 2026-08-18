import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import {
  createProcessSchema,
  updateProcessHoursSchema,
  replaceProcessSchema,
} from "./schemas";
import { canDeleteProductionProcess } from "./process-rules";
import { manufacturingToProcessData, getActiveHandicapPercent } from "./process-copy";
import { recalculateProductionState, getDetailInclude } from "./recalc";
import { recordProductionActivity } from "./activity";
import { canCompleteProcess } from "./close-rules";

async function loadItemContext(orderId, itemId) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  return { order, item };
}

function assertItemMutable(order, item) {
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden de produccion esta cancelada");
  }
  if (item.status === "CANCELLED") {
    throw new ConflictError("El item esta cancelado");
  }
  if (item.status === "COMPLETED") {
    throw new ConflictError("Reabre el item para modificar procesos");
  }
}

function toDecimal(value) {
  return new Prisma.Decimal(Number(value) || 0);
}

export async function listProcessCatalog(request) {
  await requirePermission("production.manage_processes");
  const rows = await prisma.manufacturingProcess.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });
  return jsonOk(rows);
}

export async function addProductionProcess(request, orderId, itemId) {
  await requirePermission("production.manage_processes");
  const actor = await getActor(request);
  const { order, item } = await loadItemContext(orderId, itemId);
  assertItemMutable(order, item);

  const data = createProcessSchema.parse(await request.json());
  const catalog = await prisma.manufacturingProcess.findFirst({
    where: { id: data.manufacturingProcessId, deletedAt: null, status: "ACTIVE" },
  });
  if (!catalog) throw new NotFoundError("Proceso de catalogo no encontrado");

  const handicapPercent = await getActiveHandicapPercent(prisma);
  const sortOrder = (item.processes || []).length;
  const expected =
    data.expectedHours != null ? Number(data.expectedHours) : 0;

  const created = await prisma.productionItemProcess.create({
    data: {
      productionItemId: itemId,
      ...manufacturingToProcessData(
        {
          manufacturingProcessId: catalog.id,
          processNameSnapshot: catalog.name,
          unitSnapshot: catalog.unit,
          quantity: expected,
          sortOrder,
          observations: data.notes,
        },
        { actorId: actor.id, sourceType: "PRODUCTION", handicapPercent }
      ),
      quotedHours: toDecimal(0),
      expectedHours: toDecimal(expected),
    },
  });

  await recordProductionActivity(prisma, {
    type: "PROCESS_CHANGE",
    productionOrderId: orderId,
    productionItemId: itemId,
    processId: created.id,
    body: `Proceso agregado: ${catalog.name}`,
    createdBy: actor.id,
  });

  const record = await recalculateProductionState(prisma, orderId, actor.id);
  return jsonCreated(record);
}

export async function updateProcessHours(request, orderId, itemId, processId) {
  const user = await requirePermission("production.record_process_hours");
  const actor = await getActor(request);
  const { order, item } = await loadItemContext(orderId, itemId);
  assertItemMutable(order, item);

  const process = (item.processes || []).find((p) => p.id === processId);
  if (!process) throw new NotFoundError("Proceso no encontrado");
  if (process.status === "REPLACED") {
    throw new ConflictError("No se pueden editar horas de un proceso reemplazado");
  }

  const hasSessions = (process.sessions || []).length > 0;
  if (hasSessions && !user.permissions?.includes("production.manage_planning")) {
    throw new ConflictError(
      "Este proceso tiene sesiones de piso. Las horas reales las define el cronometro, salvo un supervisor."
    );
  }

  const data = updateProcessHoursSchema.parse(await request.json());
  const patch = {
    realHours: toDecimal(data.realHours),
    updatedBy: actor.id,
  };
  if (data.notes != null) patch.notes = data.notes;
  if (data.expectedHours != null) {
    if (process.sourceType !== "PRODUCTION") {
      throw new ValidationError(
        "Las horas esperadas de un proceso cotizado no se modifican"
      );
    }
    patch.expectedHours = toDecimal(data.expectedHours);
  }

  await prisma.productionItemProcess.update({
    where: { id: processId },
    data: patch,
  });

  await recordProductionActivity(prisma, {
    type: "HOURS_MANUAL",
    productionOrderId: orderId,
    productionItemId: itemId,
    processId,
    body: `Horas reales: ${data.realHours} h en ${process.processNameSnapshot}`,
    payload: { previous: Number(process.realHours) || 0, next: data.realHours },
    createdBy: actor.id,
  });

  const record = await recalculateProductionState(prisma, orderId, actor.id);
  return jsonOk(record);
}

export async function completeProcess(request, orderId, itemId, processId) {
  await requirePermission("production.record_process_hours");
  const actor = await getActor(request);
  const { order, item } = await loadItemContext(orderId, itemId);
  assertItemMutable(order, item);

  const process = (item.processes || []).find((p) => p.id === processId);
  if (!process) throw new NotFoundError("Proceso no encontrado");
  if (process.status === "REPLACED") {
    throw new ConflictError("El proceso ya fue reemplazado");
  }
  const ownerId = process.assignedToUserId || item.assignedToUserId || actor.id;
  const check = canCompleteProcess(
    {
      ...process,
      assignedToUserId: ownerId,
    },
    {
      requireHours:
        Number(process.quotedHours) > 0 || Number(process.expectedHours) > 0,
    }
  );
  if (!check.ok) throw new ConflictError(check.reason);

  await prisma.productionItemProcess.update({
    where: { id: processId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      startedAt: process.startedAt || new Date(),
      assignedToUserId: ownerId,
      updatedBy: actor.id,
    },
  });

  await recordProductionActivity(prisma, {
    type: "PROCESS_CHANGE",
    productionOrderId: orderId,
    productionItemId: itemId,
    processId,
    body: `Proceso completado: ${process.processNameSnapshot}`,
    createdBy: actor.id,
  });

  const record = await recalculateProductionState(prisma, orderId, actor.id);
  return jsonOk(record);
}

export async function replaceProcess(request, orderId, itemId, processId) {
  await requirePermission("production.manage_processes");
  const actor = await getActor(request);
  const { order, item } = await loadItemContext(orderId, itemId);
  assertItemMutable(order, item);

  const original = (item.processes || []).find((p) => p.id === processId);
  if (!original) throw new NotFoundError("Proceso no encontrado");
  if (original.status === "REPLACED") {
    throw new ConflictError("El proceso ya fue reemplazado");
  }

  const data = replaceProcessSchema.parse(await request.json());
  const catalog = await prisma.manufacturingProcess.findFirst({
    where: { id: data.manufacturingProcessId, deletedAt: null, status: "ACTIVE" },
  });
  if (!catalog) throw new NotFoundError("Proceso de catalogo no encontrado");

  const expected =
    data.expectedHours != null
      ? Number(data.expectedHours)
      : Number(original.expectedHours) || 0;

  await prisma.$transaction(async (tx) => {
    const replacement = await tx.productionItemProcess.create({
      data: {
        productionItemId: itemId,
        sourceType: "PRODUCTION",
        manufacturingProcessId: catalog.id,
        processNameSnapshot: catalog.name,
        unitSnapshot: catalog.unit,
        quotedHours: toDecimal(0),
        expectedHours: toDecimal(expected),
        realHours: toDecimal(0),
        status: "PENDING",
        sortOrder: (item.processes || []).length,
        notes: `Reemplaza: ${original.processNameSnapshot}. Motivo: ${data.reason}`,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await tx.productionItemProcess.update({
      where: { id: processId },
      data: {
        status: "REPLACED",
        replacedProcessId: replacement.id,
        replacementReason: data.reason,
        replacedAt: new Date(),
        replacedBy: actor.id,
    });
    await recordProductionActivity(tx, {
      type: "PROCESS_CHANGE",
      productionOrderId: orderId,
      productionItemId: itemId,
      processId,
      body: `Proceso sustituido: ${original.processNameSnapshot} -> ${catalog.name}. ${data.reason}`,
      createdBy: actor.id,
    });
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionItemProcess",
    entityId: processId,
    action: AUDIT_ACTIONS.UPDATE,
    newData: {
      type: "REPLACE",
      original: original.processNameSnapshot,
      replacement: catalog.name,
      reason: data.reason,
    },
  });

  const record = await recalculateProductionState(prisma, orderId, actor.id);
  return jsonOk(record);
}

export async function deleteProductionProcess(request, orderId, itemId, processId) {
  await requirePermission("production.manage_processes");
  const actor = await getActor(request);
  const { order, item } = await loadItemContext(orderId, itemId);
  assertItemMutable(order, item);

  const process = (item.processes || []).find((p) => p.id === processId);
  if (!process) throw new NotFoundError("Proceso no encontrado");
  if (!canDeleteProductionProcess(process)) {
    throw new ConflictError(
      "Solo se pueden eliminar procesos agregados en produccion sin horas ni historial"
    );
  }

  await prisma.productionItemProcess.delete({ where: { id: processId } });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionItemProcess",
    entityId: processId,
    action: AUDIT_ACTIONS.DELETE,
    previousData: {
      productionOrderId: orderId,
      productionItemId: itemId,
      processName: process.processNameSnapshot,
      sourceType: process.sourceType,
    },
  });

  const record = await recalculateProductionState(prisma, orderId, actor.id);
  return jsonOk(record);
}
