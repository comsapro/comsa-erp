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
  reopenReasonText,
} from "./constants";
import {
  updateItemProgressSchema,
  productionNoteSchema,
  reprintSchema,
  reopenItemSchema,
  uncompleteItemSchema,
} from "./schemas";
import { getQuoteProductionDocsForOrder } from "./attachments";
import { computeProgress } from "./progress";
import { canCompleteItem, canCompleteOrder } from "./close-rules";
import { recordProductionActivity } from "./activity";
import { copyQuotedProcessesForOrderItems } from "./process-copy";
import {
  PRODUCTION_DETAIL_INCLUDE,
  recalculateProductionState,
} from "./recalc";

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
  items: {
    select: {
      id: true,
      status: true,
      priority: true,
      commitmentDate: true,
      plannedStartAt: true,
      plannedEndAt: true,
    },
  },
};

const DETAIL_INCLUDE = PRODUCTION_DETAIL_INCLUDE;

async function findProductionOrThrow(id, include = undefined) {
  const record = await prisma.productionOrder.findFirst({
    where: { id },
    include,
  });
  if (!record) throw new NotFoundError("Orden de produccion no encontrada");
  return record;
}

async function attachSourceMaterials(record, canViewCost) {
  const items = record.items || [];
  const quoteItemIds = items
    .filter((i) => i.sourceItemType === "QUOTE_ITEM")
    .map((i) => i.sourceItemId)
    .filter(Boolean);
  if (!quoteItemIds.length) {
    return {
      ...record,
      items: items.map((item) => ({ ...item, sourceMaterials: [] })),
    };
  }
  const materials = await prisma.quoteItemMaterial.findMany({
    where: { quoteItemId: { in: quoteItemIds } },
    include: {
      item: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  const extras = await prisma.quoteItemExtra.findMany({
    where: { quoteItemId: { in: quoteItemIds } },
    include: { supplier: { select: { id: true, name: true } } },
  });
  const byItem = new Map();
  for (const mat of materials) {
    const list = byItem.get(mat.quoteItemId) || [];
    list.push({
      id: mat.id,
      kind: "MATERIAL",
      itemId: mat.itemId,
      sku: mat.item?.sku || null,
      descriptionSnapshot: mat.descriptionSnapshot,
      dimensions: mat.dimensions,
      presentation: mat.presentation,
      unit: mat.unit,
      quantity: mat.quantity,
      supplierId: mat.supplierId,
      supplierName: mat.supplier?.name || null,
      ...(canViewCost ? { unitPrice: mat.unitPrice, amount: mat.amount } : {}),
    });
    byItem.set(mat.quoteItemId, list);
  }
  for (const extra of extras) {
    const list = byItem.get(extra.quoteItemId) || [];
    list.push({
      id: extra.id,
      kind: "EXTRA",
      itemId: null,
      sku: null,
      descriptionSnapshot: extra.description,
      dimensions: null,
      presentation: null,
      unit: extra.unit,
      quantity: extra.quantity,
      supplierId: extra.supplierId,
      supplierName: extra.supplier?.name || null,
      ...(canViewCost ? { unitPrice: extra.unitPrice, amount: extra.amount } : {}),
    });
    byItem.set(extra.quoteItemId, list);
  }
  return {
    ...record,
    items: items.map((item) => ({
      ...item,
      sourceMaterials: byItem.get(item.sourceItemId) || [],
    })),
  };
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
  const user = await requirePermission("production.view");
  const record = await findProductionOrThrow(id, DETAIL_INCLUDE);
  const quoteDocumentation = await getQuoteProductionDocsForOrder(record);
  const withMaterials = await attachSourceMaterials(
    record,
    user.permissions?.includes("quotes.view_cost")
  );
  return jsonOk({ ...withMaterials, quoteDocumentation });
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

  await recordProductionActivity(prisma, {
    type: "STATUS",
    productionOrderId: id,
    body: `Orden ${record.folio} iniciada`,
    createdBy: actor.id,
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

  const close = canCompleteOrder(existing);
  if (!close.ok) throw new ConflictError(close.reason);

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

  await recordProductionActivity(prisma, {
    type: "CLOSE",
    productionOrderId: id,
    body: `Orden ${record.folio} cerrada`,
    createdBy: actor.id,
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
        status: { in: ["PENDING", "IN_PROGRESS", "REWORK"] },
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

    return recalculateProductionState(tx, orderId, actor.id);
  });

  await recordProductionActivity(prisma, {
    type: "STATUS",
    productionOrderId: orderId,
    productionItemId: itemId,
    body: `Partida ${item.position} iniciada`,
    createdBy: actor.id,
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
      await recordProductionActivity(tx, {
        type: "NOTE",
        productionOrderId: orderId,
        productionItemId: itemId,
        body: noteBody,
        createdBy: actor.id,
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

    return recalculateProductionState(tx, orderId, actor.id);
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
  const close = canCompleteItem({
    ...item,
    assignedToUserId: item.assignedToUserId || actor.id,
  });
  if (!close.ok) throw new ConflictError(close.reason);

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
        assignedToUserId: item.assignedToUserId || actor.id,
        updatedBy: actor.id,
      },
    });

    return recalculateProductionState(tx, orderId, actor.id);
  });

  await recordProductionActivity(prisma, {
    type: "CLOSE",
    productionOrderId: orderId,
    productionItemId: itemId,
    body: `Partida ${item.position} completada`,
    createdBy: actor.id,
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

export async function reopenItem(request, orderId, itemId) {
  await requirePermission("production.reopen_item");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden de produccion esta cancelada");
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  if (item.status !== "COMPLETED") {
    throw new ConflictError("Solo se pueden reabrir items completados");
  }

  const data = reopenItemSchema.parse(await request.json());
  const reason = reopenReasonText(data.reasonCode, data.reason);

  const record = await prisma.$transaction(async (tx) => {
    await tx.productionItem.update({
      where: { id: itemId },
      data: { status: "REWORK" },
    });

    await tx.productionItemProcess.updateMany({
      where: {
        productionItemId: itemId,
        status: "COMPLETED",
      },
      data: { status: "PENDING", updatedBy: actor.id },
    });

    await tx.productionItemNote.create({
      data: {
        productionItemId: itemId,
        body: `Reabierto / retrabajo: ${reason}`,
        createdBy: actor.id,
      },
    });
    await recordProductionActivity(tx, {
      type: "REOPEN",
      productionOrderId: orderId,
      productionItemId: itemId,
      body: `Reabierto / retrabajo: ${reason}`,
      createdBy: actor.id,
    });

    return recalculateProductionState(tx, orderId, actor.id);
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionItem",
    entityId: itemId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: {
      status: item.status,
      completedAt: item.completedAt,
      completedBy: item.completedBy,
      orderStatus: order.status,
    },
    newData: {
      status: "REWORK",
      reasonCode: data.reasonCode,
      reason,
      previousCompletedAt: item.completedAt,
      orderStatus: record.status,
    },
  });

  return jsonOk(record);
}

// Deshacer un terminado capturado por error: se quita el cierre de la partida sin tocar
// el avance ni los procesos, para que piso pueda corregir y volver a cerrarla.
export async function uncompleteItem(request, orderId, itemId) {
  await requirePermission("production.reopen_item");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(orderId, DETAIL_INCLUDE);
  if (order.status === "CANCELLED") {
    throw new ConflictError("La orden de produccion esta cancelada");
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  if (item.status !== "COMPLETED") {
    throw new ConflictError("Solo se puede deshacer el terminado de items completados");
  }

  const data = uncompleteItemSchema.parse(await request.json());
  const reason = reopenReasonText(data.reasonCode, data.reason);
  const nextStatus =
    item.startedAt || Number(item.completedQuantity) > 0 ? "IN_PROGRESS" : "PENDING";

  const record = await prisma.$transaction(async (tx) => {
    await tx.productionItem.update({
      where: { id: itemId },
      data: {
        status: nextStatus,
        completedAt: null,
        completedBy: null,
        durationMinutes: null,
        updatedBy: actor.id,
      },
    });

    await tx.productionItemNote.create({
      data: {
        productionItemId: itemId,
        body: `Terminado deshecho: ${reason}`,
        createdBy: actor.id,
      },
    });
    await recordProductionActivity(tx, {
      type: "STATUS",
      productionOrderId: orderId,
      productionItemId: itemId,
      body: `Terminado deshecho: ${reason}`,
      createdBy: actor.id,
    });

    return recalculateProductionState(tx, orderId, actor.id);
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionItem",
    entityId: itemId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: {
      status: item.status,
      completedAt: item.completedAt,
      completedBy: item.completedBy,
      orderStatus: order.status,
    },
    newData: {
      status: nextStatus,
      reasonCode: data.reasonCode,
      reason,
      previousCompletedAt: item.completedAt,
      orderStatus: record.status,
    },
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
  await recordProductionActivity(prisma, {
    type: "NOTE",
    productionOrderId: orderId,
    productionItemId: itemId,
    body: data.body,
    createdBy: actor.id,
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

    await copyQuotedProcessesForOrderItems(tx, created.items, actor.id);

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
