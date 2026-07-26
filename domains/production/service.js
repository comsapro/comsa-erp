import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { generateFolio } from "@/lib/folios";
import {
  PRODUCTION_STATUSES,
  PRODUCTION_SOURCE_TYPES,
} from "./constants";
import { updateItemProgressSchema, productionNoteSchema, reprintSchema } from "./schemas";

const SORTABLE = [
  "folio",
  "status",
  "approvalDate",
  "progressPercentage",
  "createdAt",
];

const LIST_INCLUDE = {
  client: { select: { id: true, commercialName: true } },
  quote: { select: { id: true, folio: true, status: true } },
  directOrder: { select: { id: true, folio: true, status: true } },
};

const DETAIL_INCLUDE = {
  client: true,
  quote: { select: { id: true, folio: true, status: true } },
  directOrder: { select: { id: true, folio: true, status: true } },
  materialsReadyByUser: { select: { id: true, name: true } },
  purchaseOrders: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      folio: true,
      status: true,
      receipts: {
        select: { id: true, folio: true, receiptDate: true },
        take: 5,
        orderBy: { receiptDate: "desc" },
      },
    },
  },
  items: {
    orderBy: { position: "asc" },
    include: {
      completedByUser: { select: { id: true, name: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdByUser: { select: { id: true, name: true } } },
      },
    },
  },
};

async function findProductionOrThrow(id, include = undefined) {
  const record = await prisma.productionOrder.findFirst({
    where: { id },
    include,
  });
  if (!record) throw new NotFoundError("Orden de produccion no encontrada");
  return record;
}

function computeProgress(items) {
  const hasCancelled = items.some((i) => i.status === "CANCELLED");
  const countable = hasCancelled
    ? items.filter((i) => i.status !== "CANCELLED")
    : items;
  const totalItems = countable.length;
  const completedItems = countable.filter((i) => i.status === "COMPLETED").length;
  const progressPercentage =
    totalItems === 0
      ? 0
      : Math.round((completedItems / totalItems) * 10000) / 100;
  return { totalItems, completedItems, progressPercentage };
}

async function recalculateProgress(tx, productionOrderId) {
  const items = await tx.productionItem.findMany({
    where: { productionOrderId },
  });
  const progress = computeProgress(items);
  return tx.productionOrder.update({
    where: { id: productionOrderId },
    data: progress,
    include: DETAIL_INCLUDE,
  });
}

function assertOrderNotTerminal(order) {
  if (order.status === "COMPLETED") {
    throw new ConflictError("La orden de produccion ya esta completada");
  }
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden de produccion esta cancelada");
  }
}

export async function listProduction(request) {
  await requirePermission("production.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  const where = {};

  const tab = params.searchParams.get("tab");
  if (tab === "in_progress") {
    where.status = { in: ["PENDING", "IN_PROGRESS"] };
  } else if (tab === "completed") {
    where.status = "COMPLETED";
  } else if (tab === "all") {
    // sin filtro de estatus
  } else if (PRODUCTION_STATUSES.includes(params.status)) {
    where.status = params.status;
  } else {
    // Por defecto: en progreso
    where.status = { in: ["PENDING", "IN_PROGRESS"] };
  }

  const sourceType = params.searchParams.get("sourceType");
  if (PRODUCTION_SOURCE_TYPES.includes(sourceType)) {
    where.sourceType = sourceType;
  }

  if (params.q) {
    where.OR = [
      { folio: { contains: params.q, mode: "insensitive" } },
      {
        client: {
          commercialName: { contains: params.q, mode: "insensitive" },
        },
      },
      {
        quote: {
          folio: { contains: params.q, mode: "insensitive" },
        },
      },
      {
        directOrder: {
          folio: { contains: params.q, mode: "insensitive" },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: LIST_INCLUDE,
    }),
    prisma.productionOrder.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getProduction(request, id) {
  await requirePermission("production.view");
  const record = await findProductionOrThrow(id, DETAIL_INCLUDE);
  return jsonOk(record);
}

export async function startProduction(request, id) {
  await requirePermission("production.start");
  const actor = await getActor(request);
  const existing = await findProductionOrThrow(id, DETAIL_INCLUDE);

  if (existing.status !== "PENDING") {
    throw new ConflictError(
      "Solo se pueden iniciar ordenes de produccion pendientes"
    );
  }

  const record = await prisma.productionOrder.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function completeOrder(request, id) {
  await requirePermission("production.complete_order");
  const actor = await getActor(request);
  const existing = await findProductionOrThrow(id, DETAIL_INCLUDE);

  assertOrderNotTerminal(existing);

  const activeItems = existing.items.filter((i) => i.status !== "CANCELLED");
  if (!activeItems.length) {
    throw new ValidationError("La orden no tiene items activos");
  }
  const incomplete = activeItems.filter((i) => i.status !== "COMPLETED");
  if (incomplete.length) {
    throw new ConflictError(
      "Todos los items activos deben estar completados para cerrar la orden"
    );
  }

  const progress = computeProgress(existing.items);
  const record = await prisma.productionOrder.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      updatedBy: actor.id,
      ...progress,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.COMPLETE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function cancelProduction(request, id) {
  await requirePermission("production.cancel");
  const actor = await getActor(request);
  const existing = await findProductionOrThrow(id, DETAIL_INCLUDE);

  assertOrderNotTerminal(existing);

  const record = await prisma.$transaction(async (tx) => {
    await tx.productionItem.updateMany({
      where: {
        productionOrderId: id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "CANCELLED" },
    });

    return tx.productionOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.CANCEL,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function startItem(request, orderId, itemId) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  assertOrderNotTerminal(order);

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  if (item.status !== "PENDING") {
    throw new ConflictError("Solo se pueden iniciar items pendientes");
  }

  const record = await prisma.$transaction(async (tx) => {
    await tx.productionItem.update({
      where: { id: itemId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    if (order.status === "PENDING") {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "IN_PROGRESS",
          startedAt: order.startedAt || new Date(),
          updatedBy: actor.id,
        },
      });
    } else {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { updatedBy: actor.id },
      });
    }

    return recalculateProgress(tx, orderId);
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.PROGRESS_UPDATE,
    previousData: order,
    newData: record,
  });

  return jsonOk(record);
}

export async function updateItemProgress(request, orderId, itemId) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  assertOrderNotTerminal(order);

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  if (item.status === "COMPLETED" || item.status === "CANCELLED") {
    throw new ConflictError(
      "No se puede actualizar el avance de un item cerrado"
    );
  }

  const body = await request.json();
  const data = updateItemProgressSchema.parse(body);
  const qty = Number(item.quantity);
  if (data.completedQuantity > qty) {
    throw new ValidationError(
      "La cantidad completada no puede exceder la cantidad del item"
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    const nextStatus =
      item.status === "PENDING" ? "IN_PROGRESS" : item.status;

    const noteBody =
      data.observations != null && String(data.observations).trim()
        ? String(data.observations).trim()
        : null;

    await tx.productionItem.update({
      where: { id: itemId },
      data: {
        completedQuantity: data.completedQuantity,
        status: nextStatus,
        startedAt: item.startedAt || new Date(),
        ...(noteBody ? { observations: noteBody } : {}),
      },
    });

    if (noteBody) {
      await tx.productionItemNote.create({
        data: {
          productionItemId: itemId,
          body: noteBody,
          createdBy: actor.id,
        },
      });
    }

    if (order.status === "PENDING") {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "IN_PROGRESS",
          startedAt: order.startedAt || new Date(),
          updatedBy: actor.id,
        },
      });
    } else {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { updatedBy: actor.id },
      });
    }

    return recalculateProgress(tx, orderId);
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.PROGRESS_UPDATE,
    previousData: order,
    newData: record,
  });

  return jsonOk(record);
}

export async function completeItem(request, orderId, itemId) {
  await requirePermission("production.complete_item");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  assertOrderNotTerminal(order);

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  if (item.status === "COMPLETED") {
    throw new ConflictError("El item ya esta completado");
  }
  if (item.status === "CANCELLED") {
    throw new ConflictError("El item esta cancelado");
  }

  const record = await prisma.$transaction(async (tx) => {
    const completedAt = new Date();
    const startedAt = item.startedAt || completedAt;
    const durationMinutes = Math.max(
      0,
      Math.round((completedAt.getTime() - new Date(startedAt).getTime()) / 60000)
    );

    await tx.productionItem.update({
      where: { id: itemId },
      data: {
        status: "COMPLETED",
        completedQuantity: item.quantity,
        completedBy: actor.id,
        completedAt,
        startedAt,
        durationMinutes,
      },
    });

    const items = await tx.productionItem.findMany({
      where: { productionOrderId: orderId },
    });
    const progress = computeProgress(items);
    const activeItems = items.filter((i) => i.status !== "CANCELLED");
    const allDone =
      activeItems.length > 0 &&
      activeItems.every((i) => i.status === "COMPLETED");

    return tx.productionOrder.update({
      where: { id: orderId },
      data: {
        ...progress,
        updatedBy: actor.id,
        ...(order.status === "PENDING"
          ? { status: "IN_PROGRESS", startedAt: order.startedAt || new Date() }
          : {}),
        ...(allDone
          ? {
              status: "COMPLETED",
              completedAt: new Date(),
            }
          : {}),
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.COMPLETE,
    previousData: order,
    newData: record,
  });

  return jsonOk(record);
}

export async function addItemNote(request, orderId, itemId) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");

  const body = await request.json();
  const data = productionNoteSchema.parse(body);

  await prisma.productionItemNote.create({
    data: {
      productionItemId: itemId,
      body: data.body,
      createdBy: actor.id,
    },
  });

  const record = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  return jsonOk(record);
}

export async function markMaterialsReady(request, id) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const existing = await findProductionOrThrow(id, DETAIL_INCLUDE);

  const record = await prisma.productionOrder.update({
    where: { id },
    data: {
      materialsReadyAt: new Date(),
      materialsReadyBy: actor.id,
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { materialsReadyAt: existing.materialsReadyAt },
    newData: { materialsReadyAt: record.materialsReadyAt },
  });

  return jsonOk(record);
}

export async function reprintSheet(request, id) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(id, DETAIL_INCLUDE);
  let reason = null;
  try {
    const body = await request.json();
    reason = reprintSchema.parse(body || {}).reason || null;
  } catch {
    reason = null;
  }

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.PRINT,
    newData: { folio: order.folio, type: "SHEET", reason },
  });

  return jsonOk({ ok: true, folio: order.folio, type: "SHEET" });
}

export async function reprintNewOrder(request, id) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const existing = await findProductionOrThrow(id, DETAIL_INCLUDE);
  const body = await request.json();
  const data = reprintSchema.parse(body);
  if (!data.reason || !String(data.reason).trim()) {
    throw new ValidationError(
      "El motivo es obligatorio para reimpresion con nuevo folio"
    );
  }

  const sourceItems = (existing.items || []).filter(
    (i) => i.status !== "CANCELLED"
  );
  const selected = data.itemIds?.length
    ? sourceItems.filter((i) => data.itemIds.includes(i.id))
    : sourceItems.filter((i) => i.status !== "COMPLETED");

  if (!selected.length) {
    throw new ValidationError("No hay items para la nueva orden de produccion");
  }

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "PRODUCTION");
    const created = await tx.productionOrder.create({
      data: {
        folio,
        sourceType: existing.sourceType,
        clientId: existing.clientId,
        quoteId: existing.quoteId,
        approvalDate: existing.approvalDate,
        status: "PENDING",
        totalItems: selected.length,
        completedItems: 0,
        progressPercentage: 0,
        reprintOfId: existing.id,
        reprintReason: data.reason,
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: selected.map((item, idx) => ({
            sourceItemId: item.sourceItemId,
            sourceItemType: item.sourceItemType,
            position: idx + 1,
            description: item.description,
            quantity: item.quantity,
            status: "PENDING",
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });

    if (existing.quoteId) {
      await tx.quote.update({
        where: { id: existing.quoteId },
        data: { productionOrderId: created.id, updatedBy: actor.id },
      });
    }

    return created;
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      folio: record.folio,
      type: "NEW_ORDER_REPRINT",
      reprintOfId: existing.id,
      reason: data.reason,
    },
  });

  return jsonOk(record);
}
