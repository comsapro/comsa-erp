import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  NotFoundError,
  ValidationError,
} from "@/lib/permissions/errors";
import { entrySchema, exitSchema, adjustSchema } from "./schemas";
import { postMovement, isLowStock } from "./stock-engine";
import { toNumber } from "@/lib/quotes/calculations";

const MOVEMENT_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true } },
  destinationWarehouse: { select: { id: true, code: true, name: true } },
  item: {
    select: {
      id: true,
      sku: true,
      name: true,
      itemType: true,
      unitOfMeasure: true,
      minimumStock: true,
    },
  },
  createdByUser: { select: { id: true, name: true, email: true } },
};

const STOCK_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true, status: true } },
  item: {
    select: {
      id: true,
      sku: true,
      name: true,
      itemType: true,
      unitOfMeasure: true,
      minimumStock: true,
      isInventoryControlled: true,
      status: true,
    },
  },
};

async function assertActiveWarehouse(id) {
  const wh = await prisma.warehouse.findFirst({
    where: { id, deletedAt: null, status: "ACTIVE" },
  });
  if (!wh) throw new ValidationError("Almacen inactivo o inexistente");
  return wh;
}

async function assertActiveItem(id) {
  const item = await prisma.item.findFirst({
    where: { id, deletedAt: null, status: "ACTIVE" },
  });
  if (!item) throw new ValidationError("Item inactivo o inexistente");
  return item;
}

export async function listStock(request) {
  await requirePermission("inventory.view");
  const params = parseListParams(request, {
    allowedSort: ["updatedAt", "quantity", "availableQuantity"],
    defaultSort: "updatedAt",
  });
  const { searchParams } = params;
  const warehouseId = searchParams.get("warehouseId") || "";
  const itemType = searchParams.get("itemType") || "";
  const lowStock = searchParams.get("lowStock") === "1";
  const itemId = searchParams.get("itemId") || "";

  const where = {
    ...(warehouseId ? { warehouseId } : {}),
    ...(itemId ? { itemId } : {}),
    item: {
      deletedAt: null,
      ...(itemType ? { itemType } : {}),
      ...(params.q
        ? {
            OR: [
              { sku: { contains: params.q, mode: "insensitive" } },
              { name: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    warehouse: { deletedAt: null },
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryStock.findMany({
      where,
      include: STOCK_INCLUDE,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
    }),
    prisma.inventoryStock.count({ where }),
  ]);

  let data = rows;
  if (lowStock) {
    data = rows.filter((r) =>
      isLowStock(r.availableQuantity, r.item.minimumStock)
    );
  }

  const canViewCost = false;
  void canViewCost;

  return jsonOk(paginated(data, lowStock ? data.length : total, params));
}

export async function listLowStock(request) {
  await requirePermission("inventory.view");
  const params = parseListParams(request, {
    allowedSort: ["availableQuantity", "updatedAt"],
    defaultSort: "availableQuantity",
    defaultOrder: "asc",
  });
  const { searchParams } = params;
  const warehouseId = searchParams.get("warehouseId") || "";
  const itemType = searchParams.get("itemType") || "";

  const stocks = await prisma.inventoryStock.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      item: {
        deletedAt: null,
        isInventoryControlled: true,
        ...(itemType ? { itemType } : {}),
        ...(params.q
          ? {
              OR: [
                { sku: { contains: params.q, mode: "insensitive" } },
                { name: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      warehouse: { deletedAt: null },
    },
    include: {
      ...STOCK_INCLUDE,
      item: {
        select: {
          id: true,
          sku: true,
          name: true,
          itemType: true,
          unitOfMeasure: true,
          minimumStock: true,
        },
      },
    },
  });

  const low = stocks
    .filter((r) => isLowStock(r.availableQuantity, r.item.minimumStock))
    .map((r) => ({
      ...r,
      difference:
        toNumber(r.item.minimumStock) - toNumber(r.availableQuantity),
    }))
    .sort((a, b) => b.difference - a.difference);

  // Ultima entrada por item/warehouse
  const enriched = await Promise.all(
    low.slice(params.skip, params.skip + params.take).map(async (row) => {
      const lastEntry = await prisma.inventoryMovement.findFirst({
        where: {
          warehouseId: row.warehouseId,
          itemId: row.itemId,
          movementType: { in: ["ENTRY", "ADJUSTMENT_IN", "TRANSFER_IN"] },
        },
        orderBy: { movementDate: "desc" },
        select: { movementDate: true, folio: true },
      });
      return { ...row, lastEntryDate: lastEntry?.movementDate || null };
    })
  );

  return jsonOk(paginated(enriched, low.length, params));
}

export async function listMovements(request) {
  await requirePermission("inventory.view");
  const params = parseListParams(request, {
    allowedSort: ["movementDate", "folio", "createdAt", "quantity"],
    defaultSort: "movementDate",
  });
  const { searchParams } = params;
  const warehouseId = searchParams.get("warehouseId") || "";
  const itemId = searchParams.get("itemId") || "";
  const movementType = searchParams.get("movementType") || "";
  const referenceType = searchParams.get("referenceType") || "";
  const referenceId = searchParams.get("referenceId") || "";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where = {
    ...(warehouseId ? { warehouseId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(movementType ? { movementType } : {}),
    ...(referenceType ? { referenceType } : {}),
    ...(referenceId ? { referenceId } : {}),
    ...(dateFrom || dateTo
      ? {
          movementDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { folio: { contains: params.q, mode: "insensitive" } },
            { reason: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } },
            { item: { sku: { contains: params.q, mode: "insensitive" } } },
            { item: { name: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const canViewCost = true;
  const user = await requirePermission("inventory.view");
  const hideCost = !user.permissions.includes("inventory.view_cost");

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const data = hideCost
    ? rows.map((r) => {
        const { unitCost, ...rest } = r;
        void unitCost;
        return rest;
      })
    : rows;

  void canViewCost;
  return jsonOk(paginated(data, total, params));
}

export async function getMovement(request, id) {
  const user = await requirePermission("inventory.view");
  const record = await prisma.inventoryMovement.findUnique({
    where: { id },
    include: MOVEMENT_INCLUDE,
  });
  if (!record) throw new NotFoundError("Movimiento no encontrado");
  if (!user.permissions.includes("inventory.view_cost")) {
    const { unitCost, ...rest } = record;
    void unitCost;
    return jsonOk(rest);
  }
  return jsonOk(record);
}

export async function createEntry(request) {
  await requirePermission("inventory.create_entry");
  const actor = await getActor(request);
  const body = entrySchema.parse(await request.json());
  await assertActiveWarehouse(body.warehouseId);
  await assertActiveItem(body.itemId);

  const result = await prisma.$transaction(async (tx) =>
    postMovement(tx, {
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      movementType: "ENTRY",
      quantity: body.quantity,
      unitCost: body.unitCost,
      referenceType: body.referenceType || "INITIAL_BALANCE",
      referenceId: body.referenceId || null,
      notes: body.notes,
      movementDate: body.movementDate || new Date(),
      createdBy: actor.id,
    })
  );

  await recordAudit({
    actor,
    module: "inventory",
    entity: "InventoryMovement",
    entityId: result.movement.id,
    action: AUDIT_ACTIONS.ENTRY,
    newData: result.movement,
  });

  return jsonCreated(result.movement);
}

export async function createExit(request) {
  await requirePermission("inventory.create_exit");
  const actor = await getActor(request);
  const body = exitSchema.parse(await request.json());
  await assertActiveWarehouse(body.warehouseId);
  await assertActiveItem(body.itemId);

  let referenceType = body.referenceType || null;
  let referenceId = body.referenceId || null;

  if (body.productionOrderId) {
    const po = await prisma.productionOrder.findUnique({
      where: { id: body.productionOrderId },
    });
    if (!po) throw new ValidationError("Orden de produccion no encontrada");
    referenceType = body.productionItemId
      ? "PRODUCTION_ITEM"
      : "PRODUCTION_ORDER";
    referenceId = body.productionItemId || body.productionOrderId;
  }

  const result = await prisma.$transaction(async (tx) =>
    postMovement(tx, {
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      movementType: "EXIT",
      quantity: body.quantity,
      referenceType,
      referenceId,
      notes: body.notes,
      movementDate: body.movementDate || new Date(),
      createdBy: actor.id,
    })
  );

  await recordAudit({
    actor,
    module: "inventory",
    entity: "InventoryMovement",
    entityId: result.movement.id,
    action: AUDIT_ACTIONS.EXIT,
    newData: result.movement,
  });

  return jsonCreated(result.movement);
}

export async function createAdjustment(request) {
  await requirePermission("inventory.adjust");
  const actor = await getActor(request);
  const body = adjustSchema.parse(await request.json());
  await assertActiveWarehouse(body.warehouseId);
  await assertActiveItem(body.itemId);

  const movementType =
    body.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";

  const result = await prisma.$transaction(async (tx) =>
    postMovement(tx, {
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      movementType,
      quantity: body.quantity,
      unitCost: body.unitCost,
      referenceType: "MANUAL_ADJUSTMENT",
      reason: body.reason,
      notes: body.notes,
      movementDate: body.movementDate || new Date(),
      createdBy: actor.id,
    })
  );

  await recordAudit({
    actor,
    module: "inventory",
    entity: "InventoryMovement",
    entityId: result.movement.id,
    action: AUDIT_ACTIONS.INVENTORY_ADJUST,
    newData: result.movement,
  });

  return jsonCreated(result.movement);
}

export async function getStockByItemWarehouse(request) {
  await requirePermission("inventory.view");
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get("warehouseId");
  const itemId = searchParams.get("itemId");
  if (!warehouseId || !itemId) {
    throw new ValidationError("warehouseId e itemId son requeridos");
  }
  const stock = await prisma.inventoryStock.findUnique({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    include: STOCK_INCLUDE,
  });
  return jsonOk(
    stock || {
      warehouseId,
      itemId,
      quantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    }
  );
}
