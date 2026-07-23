import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { generateFolio } from "@/lib/folios";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/permissions/errors";
import { Prisma } from "@prisma/client";
import { transferCreateSchema, transferUpdateSchema } from "./schemas";
import { VALID_TRANSITIONS } from "./constants";
import { postMovement } from "@/domains/inventory/stock-engine";

const DETAIL_INCLUDE = {
  sourceWarehouse: { select: { id: true, code: true, name: true } },
  destinationWarehouse: { select: { id: true, code: true, name: true } },
  requestedByUser: { select: { id: true, name: true } },
  approvedByUser: { select: { id: true, name: true } },
  completedByUser: { select: { id: true, name: true } },
  items: {
    include: {
      item: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
    },
  },
};

function assertTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError(
      `No se puede cambiar de ${from} a ${to}`
    );
  }
}

async function getTransferOrThrow(id) {
  const record = await prisma.warehouseTransfer.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError("Transferencia no encontrada");
  return record;
}

export async function listTransfers(request) {
  await requirePermission("inventory.transfer");
  const params = parseListParams(request, {
    allowedSort: ["createdAt", "requestedAt", "folio", "status"],
    defaultSort: "createdAt",
  });
  const { searchParams } = params;
  const warehouseId = searchParams.get("warehouseId") || "";

  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(warehouseId
      ? {
          OR: [
            { sourceWarehouseId: warehouseId },
            { destinationWarehouseId: warehouseId },
          ],
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { folio: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.warehouseTransfer.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
    }),
    prisma.warehouseTransfer.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getTransfer(_request, id) {
  await requirePermission("inventory.transfer");
  return jsonOk(await getTransferOrThrow(id));
}

export async function createTransfer(request) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);
  const body = transferCreateSchema.parse(await request.json());

  if (body.sourceWarehouseId === body.destinationWarehouseId) {
    throw new ValidationError(
      "El almacen origen y destino deben ser diferentes"
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "WAREHOUSE_TRANSFER");
    return tx.warehouseTransfer.create({
      data: {
        folio,
        sourceWarehouseId: body.sourceWarehouseId,
        destinationWarehouseId: body.destinationWarehouseId,
        notes: body.notes,
        status: "DRAFT",
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: body.items.map((it) => ({
            itemId: it.itemId,
            quantity: new Prisma.Decimal(it.quantity),
            notes: it.notes,
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function updateTransfer(request, id) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);
  const existing = await getTransferOrThrow(id);
  if (existing.status !== "DRAFT") {
    throw new ConflictError("Solo se pueden editar transferencias en borrador");
  }
  const body = transferUpdateSchema.parse(await request.json());
  const sourceId = body.sourceWarehouseId || existing.sourceWarehouseId;
  const destId =
    body.destinationWarehouseId || existing.destinationWarehouseId;
  if (sourceId === destId) {
    throw new ValidationError(
      "El almacen origen y destino deben ser diferentes"
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    if (body.items) {
      await tx.warehouseTransferItem.deleteMany({ where: { transferId: id } });
      await tx.warehouseTransferItem.createMany({
        data: body.items.map((it) => ({
          transferId: id,
          itemId: it.itemId,
          quantity: new Prisma.Decimal(it.quantity),
          notes: it.notes,
        })),
      });
    }
    return tx.warehouseTransfer.update({
      where: { id },
      data: {
        sourceWarehouseId: sourceId,
        destinationWarehouseId: destId,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function submitTransfer(request, id) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);
  const existing = await getTransferOrThrow(id);
  assertTransition(existing.status, "PENDING");
  if (!existing.items.length) {
    throw new ValidationError("La transferencia debe tener al menos un item");
  }

  const record = await prisma.warehouseTransfer.update({
    where: { id },
    data: {
      status: "PENDING",
      requestedBy: actor.id,
      requestedAt: new Date(),
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: id,
    action: AUDIT_ACTIONS.SUBMIT,
    previousData: { status: existing.status },
    newData: { status: record.status },
  });

  return jsonOk(record);
}

export async function approveTransfer(request, id) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);
  const existing = await getTransferOrThrow(id);
  assertTransition(existing.status, "APPROVED");

  const record = await prisma.warehouseTransfer.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: actor.id,
      approvedAt: new Date(),
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: id,
    action: AUDIT_ACTIONS.APPROVE,
    previousData: { status: existing.status },
    newData: { status: record.status },
  });

  return jsonOk(record);
}

export async function completeTransfer(request, id) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);

  const record = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id, status, source_warehouse_id, destination_warehouse_id
      FROM warehouse_transfers WHERE id = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new NotFoundError("Transferencia no encontrada");
    if (row.status === "COMPLETED") {
      throw new ConflictError("La transferencia ya fue completada");
    }
    if (row.status !== "APPROVED") {
      throw new ConflictError("Solo se pueden completar transferencias aprobadas");
    }
    if (row.source_warehouse_id === row.destination_warehouse_id) {
      throw new ValidationError("Origen y destino no pueden ser iguales");
    }

    const items = await tx.warehouseTransferItem.findMany({
      where: { transferId: id },
    });
    if (!items.length) {
      throw new ValidationError("La transferencia no tiene items");
    }

    for (const item of items) {
      await postMovement(tx, {
        warehouseId: row.source_warehouse_id,
        destinationWarehouseId: row.destination_warehouse_id,
        itemId: item.itemId,
        movementType: "TRANSFER_OUT",
        quantity: item.quantity,
        referenceType: "TRANSFER",
        referenceId: id,
        createdBy: actor.id,
      });
      await postMovement(tx, {
        warehouseId: row.destination_warehouse_id,
        itemId: item.itemId,
        movementType: "TRANSFER_IN",
        quantity: item.quantity,
        referenceType: "TRANSFER",
        referenceId: id,
        createdBy: actor.id,
      });
    }

    return tx.warehouseTransfer.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedBy: actor.id,
        completedAt: new Date(),
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: id,
    action: AUDIT_ACTIONS.TRANSFER,
    newData: { status: record.status, folio: record.folio },
  });

  return jsonOk(record);
}

export async function cancelTransfer(request, id) {
  await requirePermission("inventory.transfer");
  const actor = await getActor(request);
  const existing = await getTransferOrThrow(id);
  assertTransition(existing.status, "CANCELLED");

  const record = await prisma.warehouseTransfer.update({
    where: { id },
    data: { status: "CANCELLED", updatedBy: actor.id },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "inventory",
    entity: "WarehouseTransfer",
    entityId: id,
    action: AUDIT_ACTIONS.CANCEL,
    previousData: { status: existing.status },
    newData: { status: record.status },
  });

  return jsonOk(record);
}
