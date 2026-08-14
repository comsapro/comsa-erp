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
import { poCreateSchema, poUpdateSchema, reasonSchema } from "./schemas";
import { VALID_TRANSITIONS } from "./constants";
import {
  calculatePurchaseLineTotals,
  calculatePurchaseHeaderTotals,
} from "./calculations";
import { dedupeBySourceMaterial } from "./preload";

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, name: true, legalName: true, rfc: true, status: true } },
  productionOrder: { select: { id: true, folio: true, status: true } },
  quote: {
    select: {
      id: true,
      folio: true,
      status: true,
      productionOrders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          folio: true,
          status: true,
          materialsReadyAt: true,
        },
      },
    },
  },
  requestedByUser: { select: { id: true, name: true } },
  authorizedByUser: { select: { id: true, name: true } },
  items: {
    include: {
      item: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  },
  receipts: {
    select: { id: true, folio: true, receiptDate: true, warehouseId: true },
    orderBy: { createdAt: "desc" },
  },
};

function assertTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`No se puede cambiar de ${from} a ${to}`);
  }
}

async function getPoOrThrow(id) {
  const record = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError("Orden de compra no encontrada");
  return record;
}

async function buildItemRows(items) {
  const unique = dedupeBySourceMaterial(items);
  const rows = [];
  for (const it of unique) {
    const catalog = await prisma.item.findFirst({
      where: { id: it.itemId, deletedAt: null },
    });
    if (!catalog) {
      throw new ValidationError(`Item no encontrado: ${it.itemId}`);
    }
    const totals = calculatePurchaseLineTotals(it.quantity, it.unitPrice);
    rows.push({
      itemId: it.itemId,
      descriptionSnapshot:
        it.descriptionSnapshot || catalog.name,
      quantity: new Prisma.Decimal(it.quantity),
      unit: it.unit || catalog.unitOfMeasure,
      unitPrice: new Prisma.Decimal(it.unitPrice),
      subtotal: new Prisma.Decimal(totals.subtotal),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      total: new Prisma.Decimal(totals.total),
      warehouseId: it.warehouseId || null,
      status: "PENDING",
      sourceType: it.sourceMaterialId ? "QUOTE_MATERIAL" : it.sourceType || "MANUAL",
      sourceMaterialId: it.sourceMaterialId || null,
    });
  }
  return rows;
}

export async function listPurchaseOrders(request) {
  await requirePermission("purchase_orders.view");
  const params = parseListParams(request, {
    allowedSort: ["requestDate", "folio", "createdAt", "total", "status"],
    defaultSort: "requestDate",
  });
  const { searchParams } = params;
  const supplierId = searchParams.get("supplierId") || "";
  const productionOrderId = searchParams.get("productionOrderId") || "";
  const requestedBy = searchParams.get("requestedBy") || "";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(productionOrderId ? { productionOrderId } : {}),
    ...(requestedBy ? { requestedBy } : {}),
    ...(dateFrom || dateTo
      ? {
          requestDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { folio: { contains: params.q, mode: "insensitive" } },
            { comments: { contains: params.q, mode: "insensitive" } },
            { supplier: { name: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getPurchaseOrder(_request, id) {
  await requirePermission("purchase_orders.view");
  return jsonOk(await getPoOrThrow(id));
}

export async function createPurchaseOrder(request) {
  await requirePermission("purchase_orders.create");
  const actor = await getActor(request);
  const body = poCreateSchema.parse(await request.json());

  const supplier = await prisma.supplier.findFirst({
    where: { id: body.supplierId, deletedAt: null, status: "ACTIVE" },
  });
  if (!supplier) throw new ValidationError("Proveedor inactivo o inexistente");

  const itemRows = await buildItemRows(body.items || []);
  const header = calculatePurchaseHeaderTotals(itemRows);

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "PURCHASE_ORDER", body.requestDate);
    return tx.purchaseOrder.create({
      data: {
        folio,
        supplierId: body.supplierId,
        productionOrderId: body.productionOrderId || null,
        quoteId: body.quoteId || null,
        requestedBy: actor.id,
        requestDate: body.requestDate,
        expectedDate: body.expectedDate || null,
        comments: body.comments,
        status: "DRAFT",
        subtotal: new Prisma.Decimal(header.subtotal),
        tax: new Prisma.Decimal(header.tax),
        total: new Prisma.Decimal(header.total),
        createdBy: actor.id,
        updatedBy: actor.id,
        items: { create: itemRows },
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      folio: record.folio,
      status: record.status,
      productionOrderId: record.productionOrderId,
      quoteId: record.quoteId,
      preloaded: (body.items || []).some((i) => i.sourceMaterialId),
    },
  });

  return jsonCreated(record);
}

export async function updatePurchaseOrder(request, id) {
  await requirePermission("purchase_orders.edit");
  const actor = await getActor(request);
  const existing = await getPoOrThrow(id);
  if (existing.status !== "DRAFT") {
    throw new ConflictError("Solo se pueden editar ordenes en borrador");
  }
  const body = poUpdateSchema.parse(await request.json());

  if (body.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, deletedAt: null, status: "ACTIVE" },
    });
    if (!supplier) throw new ValidationError("Proveedor inactivo o inexistente");
  }

  const itemRows =
    body.items !== undefined ? await buildItemRows(body.items) : null;
  const header = itemRows
    ? calculatePurchaseHeaderTotals(itemRows)
    : {
        subtotal: existing.subtotal,
        tax: existing.tax,
        total: existing.total,
      };

  const record = await prisma.$transaction(async (tx) => {
    if (itemRows) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: itemRows.map((r) => ({ ...r, purchaseOrderId: id })),
      });
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: body.supplierId ?? existing.supplierId,
        productionOrderId:
          body.productionOrderId !== undefined
            ? body.productionOrderId
            : existing.productionOrderId,
        quoteId: body.quoteId !== undefined ? body.quoteId : existing.quoteId,
        requestDate: body.requestDate ?? existing.requestDate,
        expectedDate:
          body.expectedDate !== undefined
            ? body.expectedDate
            : existing.expectedDate,
        comments:
          body.comments !== undefined ? body.comments : existing.comments,
        subtotal: new Prisma.Decimal(header.subtotal),
        tax: new Prisma.Decimal(header.tax),
        total: new Prisma.Decimal(header.total),
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: { folio: record.folio },
  });

  return jsonOk(record);
}

export async function submitPurchaseOrder(request, id) {
  await requirePermission("purchase_orders.submit");
  const actor = await getActor(request);
  const existing = await getPoOrThrow(id);
  assertTransition(existing.status, "PENDING_APPROVAL");
  if (!existing.items.length) {
    throw new ValidationError(
      "La orden debe tener al menos un item antes de enviarse"
    );
  }

  const record = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "PENDING_APPROVAL", updatedBy: actor.id },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.SUBMIT,
    previousData: { status: existing.status },
    newData: { status: record.status },
  });

  return jsonOk(record);
}

export async function approvePurchaseOrder(request, id) {
  await requirePermission("purchase_orders.approve");
  const actor = await getActor(request);
  const existing = await getPoOrThrow(id);
  assertTransition(existing.status, "APPROVED");

  const record = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "APPROVED",
      authorizedBy: actor.id,
      authorizationDate: new Date(),
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.APPROVE,
    previousData: { status: existing.status },
    newData: { status: record.status },
  });

  return jsonOk(record);
}

export async function rejectPurchaseOrder(request, id) {
  await requirePermission("purchase_orders.reject");
  const actor = await getActor(request);
  const existing = await getPoOrThrow(id);
  assertTransition(existing.status, "REJECTED");
  const body = reasonSchema.parse(await request.json());

  const record = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: body.reason,
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.REJECT,
    previousData: { status: existing.status },
    newData: { status: record.status, reason: body.reason },
  });

  return jsonOk(record);
}

export async function cancelPurchaseOrder(request, id) {
  await requirePermission("purchase_orders.cancel");
  const actor = await getActor(request);
  const existing = await getPoOrThrow(id);
  assertTransition(existing.status, "CANCELLED");
  const body = reasonSchema.parse(await request.json());

  const record = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancellationReason: body.reason,
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.CANCEL,
    previousData: { status: existing.status },
    newData: { status: record.status, reason: body.reason },
  });

  return jsonOk(record);
}

export async function listPreloadMaterials(request) {
  const user = await requirePermission("purchase_orders.create");
  const { searchParams } = new URL(request.url);
  const productionOrderId = searchParams.get("productionOrderId");
  const quoteId = searchParams.get("quoteId");

  if (productionOrderId) {
    const { listProductionMaterials } = await import(
      "@/domains/production/materials"
    );
    return listProductionMaterials(request, productionOrderId);
  }

  if (!quoteId) {
    throw new ValidationError("productionOrderId o quoteId es requerido");
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deletedAt: null },
    include: {
      productionOrder: { select: { id: true, folio: true } },
      items: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  });
  if (!quote) throw new NotFoundError("Cotizacion no encontrada");

  const quoteItemIds = (quote.items || []).map((i) => i.id);
  const materials = quoteItemIds.length
    ? await prisma.quoteItemMaterial.findMany({
        where: { quoteItemId: { in: quoteItemIds } },
        include: {
          item: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
          supplier: { select: { id: true, name: true } },
        },
      })
    : [];

  const includeSalePrice = user.permissions?.includes("quotes.view_cost");
  return jsonOk({
    productionOrderId: quote.productionOrder?.id || null,
    productionFolio: quote.productionOrder?.folio || null,
    quoteId: quote.id,
    quoteFolio: quote.folio,
    materials: materials.map((mat) => ({
      id: mat.id,
      itemId: mat.itemId,
      sku: mat.item?.sku || null,
      descriptionSnapshot: mat.descriptionSnapshot,
      dimensions: mat.dimensions,
      presentation: mat.presentation,
      unit: mat.unit || mat.item?.unitOfMeasure || null,
      quantity: Number(mat.quantity) || 0,
      supplierId: mat.supplierId,
      supplierName: mat.supplier?.name || null,
      unitPrice: includeSalePrice ? Number(mat.unitPrice || 0) : 0,
    })),
  });
}
