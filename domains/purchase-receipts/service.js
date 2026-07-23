import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
import { receiptCreateSchema } from "@/domains/purchase-orders/schemas";
import {
  remainingQuantity,
  resolvePurchaseItemStatus,
  resolvePurchaseOrderStatus,
  toNumberSafe,
} from "./helpers";
import { postMovement } from "@/domains/inventory/stock-engine";
import { toNumber } from "@/lib/quotes/calculations";

function toNumberSafeLocal(v) {
  return toNumber(v);
}

void toNumberSafe;

const DETAIL_INCLUDE = {
  purchaseOrder: {
    select: { id: true, folio: true, status: true },
  },
  supplier: { select: { id: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  receivedByUser: { select: { id: true, name: true } },
  items: {
    include: {
      item: { select: { id: true, sku: true, name: true } },
      purchaseOrderItem: true,
    },
  },
};

export async function listReceipts(request) {
  await requirePermission("purchase_orders.receive");
  const params = parseListParams(request, {
    allowedSort: ["receiptDate", "folio", "createdAt"],
    defaultSort: "receiptDate",
  });
  const { searchParams } = params;
  const purchaseOrderId = searchParams.get("purchaseOrderId") || "";
  const supplierId = searchParams.get("supplierId") || "";

  const where = {
    ...(purchaseOrderId ? { purchaseOrderId } : {}),
    ...(supplierId ? { supplierId } : {}),
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
    prisma.purchaseReceipt.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
    }),
    prisma.purchaseReceipt.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getReceipt(_request, id) {
  await requirePermission("purchase_orders.receive");
  const record = await prisma.purchaseReceipt.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError("Recepcion no encontrada");
  return jsonOk(record);
}

export async function createReceipt(request) {
  await requirePermission("purchase_orders.receive");
  const actor = await getActor(request);
  const body = receiptCreateSchema.parse(await request.json());

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: body.warehouseId, deletedAt: null, status: "ACTIVE" },
  });
  if (!warehouse) {
    throw new ValidationError("Almacen inactivo o inexistente");
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id, status, supplier_id, folio
      FROM purchase_orders
      WHERE id = ${body.purchaseOrderId} AND deleted_at IS NULL
      FOR UPDATE
    `;
    const po = locked[0];
    if (!po) throw new NotFoundError("Orden de compra no encontrada");
    if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new ConflictError(
        "Solo se pueden recibir ordenes aprobadas o parcialmente recibidas"
      );
    }

    const poItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: body.purchaseOrderId },
    });
    const byId = Object.fromEntries(poItems.map((i) => [i.id, i]));

    const receiptItemsData = [];
    for (const line of body.items) {
      const poi = byId[line.purchaseOrderItemId];
      if (!poi) {
        throw new ValidationError("Item de orden no pertenece a esta OC");
      }
      const remaining = remainingQuantity(poi.quantity, poi.receivedQuantity);
      if (toNumberSafeLocal(line.receivedQuantity) > remaining + 1e-9) {
        throw new ValidationError(
          `Cantidad recibida excede lo pendiente para ${poi.descriptionSnapshot}`
        );
      }
      receiptItemsData.push({
        purchaseOrderItemId: poi.id,
        itemId: poi.itemId,
        orderedQuantity: poi.quantity,
        previouslyReceivedQuantity: poi.receivedQuantity,
        receivedQuantity: new Prisma.Decimal(line.receivedQuantity),
        unitCost: new Prisma.Decimal(
          line.unitCost ?? toNumberSafeLocal(poi.unitPrice)
        ),
      });
    }

    const folio = await generateFolio(tx, "PURCHASE_RECEIPT", body.receiptDate);
    const receipt = await tx.purchaseReceipt.create({
      data: {
        folio,
        purchaseOrderId: body.purchaseOrderId,
        supplierId: po.supplier_id,
        warehouseId: body.warehouseId,
        receiptDate: body.receiptDate,
        notes: body.notes,
        receivedBy: actor.id,
        items: { create: receiptItemsData },
      },
      include: DETAIL_INCLUDE,
    });

    for (const line of receiptItemsData) {
      await postMovement(tx, {
        warehouseId: body.warehouseId,
        itemId: line.itemId,
        movementType: "ENTRY",
        quantity: line.receivedQuantity,
        unitCost: line.unitCost,
        referenceType: "PURCHASE_ORDER",
        referenceId: body.purchaseOrderId,
        notes: `Recepcion ${folio}`,
        movementDate: body.receiptDate,
        createdBy: actor.id,
      });

      const poi = byId[line.purchaseOrderItemId];
      const newReceived =
        toNumberSafeLocal(poi.receivedQuantity) +
        toNumberSafeLocal(line.receivedQuantity);
      const itemStatus = resolvePurchaseItemStatus(poi.quantity, newReceived);
      await tx.purchaseOrderItem.update({
        where: { id: poi.id },
        data: {
          receivedQuantity: new Prisma.Decimal(newReceived),
          status: itemStatus,
        },
      });
      poi.receivedQuantity = newReceived;
    }

    const refreshed = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: body.purchaseOrderId },
    });
    const nextStatus = resolvePurchaseOrderStatus(refreshed);

    await tx.purchaseOrder.update({
      where: { id: body.purchaseOrderId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
        updatedBy: actor.id,
      },
    });

    return { receipt, nextStatus };
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseReceipt",
    entityId: result.receipt.id,
    action: AUDIT_ACTIONS.RECEIVE,
    newData: {
      folio: result.receipt.folio,
      purchaseOrderId: body.purchaseOrderId,
      status: result.nextStatus,
    },
  });

  if (result.nextStatus === "COMPLETED") {
    await recordAudit({
      actor,
      module: "purchase_orders",
      entity: "PurchaseOrder",
      entityId: body.purchaseOrderId,
      action: AUDIT_ACTIONS.COMPLETE,
      newData: { status: "COMPLETED" },
    });
  }

  return jsonCreated(result.receipt);
}
