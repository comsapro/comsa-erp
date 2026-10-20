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
import { VALID_TRANSITIONS, poEditPermission } from "./constants";
import {
  calculatePurchaseLineTotals,
  calculatePurchaseHeaderTotals,
} from "./calculations";
import { dedupeBySourceMaterial, missingCostMessage } from "./preload";

function poAuditSnapshot(po) {
  return {
    status: po.status,
    supplierId: po.supplierId,
    supplier: po.supplier?.name || null,
    subtotal: po.subtotal,
    total: po.total,
    items: (po.items || []).map((it) => ({
      description: it.descriptionSnapshot,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      supplierName: it.supplierName,
    })),
  };
}

function assertCostsCaptured(items) {
  const message = missingCostMessage(items);
  if (message) throw new ValidationError(message);
}

/** Costo cotizado de cada partida precargada, como referencia para compras y supervisor. */
async function withQuotedCosts(po, user) {
  if (!user.permissions?.includes("quotes.view_cost")) return po;
  const ids = (po.items || [])
    .filter((it) => it.sourceType === "QUOTE_MATERIAL" && it.sourceMaterialId)
    .map((it) => it.sourceMaterialId);
  if (!ids.length) return po;
  const materials = await prisma.quoteItemMaterial.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitPrice: true },
  });
  const byId = new Map(materials.map((m) => [m.id, m.unitPrice]));
  return {
    ...po,
    items: po.items.map((it) => ({
      ...it,
      quotedUnitPrice: byId.has(it.sourceMaterialId)
        ? byId.get(it.sourceMaterialId)
        : null,
    })),
  };
}

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
    const itemId = it.itemId || null;
    let catalog = null;
    if (itemId) {
      catalog = await prisma.item.findFirst({
        where: { id: itemId, deletedAt: null },
      });
      if (!catalog) {
        throw new ValidationError(`Item no encontrado: ${itemId}`);
      }
    }
    const description = String(
      it.descriptionSnapshot || catalog?.name || ""
    ).trim();
    if (!description) {
      throw new ValidationError(
        "Cada partida requiere item de catalogo o descripcion"
      );
    }
    const totals = calculatePurchaseLineTotals(it.quantity, it.unitPrice);
    rows.push({
      itemId,
      descriptionSnapshot: description,
      quantity: new Prisma.Decimal(it.quantity),
      unit: it.unit || catalog?.unitOfMeasure || null,
      dimensions: it.dimensions || null,
      presentation: it.presentation || null,
      supplierName: it.supplierName || null,
      unitPrice: new Prisma.Decimal(it.unitPrice),
      subtotal: new Prisma.Decimal(totals.subtotal),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      total: new Prisma.Decimal(totals.total),
      warehouseId: it.warehouseId || null,
      status: "PENDING",
      sourceType: it.sourceMaterialId
        ? "QUOTE_MATERIAL"
        : it.sourceType || "MANUAL",
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
  const user = await requirePermission("purchase_orders.view");
  return jsonOk(await withQuotedCosts(await getPoOrThrow(id), user));
}

export async function createPurchaseOrder(request) {
  await requirePermission("purchase_orders.create");
  const actor = await getActor(request);
  const body = poCreateSchema.parse(await request.json());

  const supplier = await prisma.supplier.findFirst({
    where: { id: body.supplierId, deletedAt: null, status: "ACTIVE" },
  });
  if (!supplier) throw new ValidationError("Proveedor inactivo o inexistente");

  const productionOrder = await prisma.productionOrder.findFirst({
    where: { id: body.productionOrderId },
    select: { id: true, folio: true, quoteId: true },
  });
  if (!productionOrder) {
    throw new ValidationError("Orden de produccion inexistente");
  }
  if (!productionOrder.quoteId) {
    throw new ValidationError(
      "La orden de produccion debe estar ligada a una cotizacion"
    );
  }
  if (productionOrder.quoteId !== body.quoteId) {
    throw new ValidationError(
      "La cotizacion no coincide con la orden de produccion seleccionada"
    );
  }

  const itemRows = await buildItemRows(body.items || []);
  const header = calculatePurchaseHeaderTotals(itemRows);

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "PURCHASE_ORDER", body.requestDate);
    return tx.purchaseOrder.create({
      data: {
        folio,
        supplierId: body.supplierId,
        productionOrderId: productionOrder.id,
        quoteId: productionOrder.quoteId,
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
  const existing = await getPoOrThrow(id);
  const editPermission = poEditPermission(existing.status);
  if (!editPermission) {
    throw new ConflictError(
      "Solo se pueden modificar ordenes en borrador o pendientes de aprobacion"
    );
  }
  const user = await requirePermission(editPermission);
  const actor = await getActor(request);
  const body = poUpdateSchema.parse(await request.json());

  if (existing.status === "PENDING_APPROVAL") {
    const relinks =
      (body.productionOrderId !== undefined &&
        body.productionOrderId !== existing.productionOrderId) ||
      (body.quoteId !== undefined && body.quoteId !== existing.quoteId);
    if (relinks) {
      throw new ConflictError(
        "Una orden pendiente de aprobacion no puede cambiar de produccion o cotizacion"
      );
    }
  }

  if (body.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, deletedAt: null, status: "ACTIVE" },
    });
    if (!supplier) throw new ValidationError("Proveedor inactivo o inexistente");
  }

  const itemRows =
    body.items !== undefined ? await buildItemRows(body.items) : null;
  if (itemRows && existing.status === "PENDING_APPROVAL") {
    assertCostsCaptured(itemRows);
  }
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
    previousData: poAuditSnapshot(existing),
    newData: { folio: record.folio, ...poAuditSnapshot(record) },
  });

  return jsonOk(await withQuotedCosts(record, user));
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
  assertCostsCaptured(existing.items);

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
  assertCostsCaptured(existing.items);

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

  const { QUOTE_MATERIAL_INCLUDE, preloadMaterialRow } = await import(
    "@/domains/production/materials"
  );
  const quoteItemIds = (quote.items || []).map((i) => i.id);
  const materials = quoteItemIds.length
    ? await prisma.quoteItemMaterial.findMany({
        where: { quoteItemId: { in: quoteItemIds } },
        include: QUOTE_MATERIAL_INCLUDE,
      })
    : [];

  const includeCost = user.permissions?.includes("quotes.view_cost");
  return jsonOk({
    productionOrderId: quote.productionOrder?.id || null,
    productionFolio: quote.productionOrder?.folio || null,
    quoteId: quote.id,
    quoteFolio: quote.folio,
    materials: materials.map((mat) => preloadMaterialRow(mat, { includeCost })),
  });
}
