import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk } from "@/lib/api/http";
import { NotFoundError } from "@/lib/permissions/errors";
import { mapSelectedMaterials } from "@/domains/purchase-orders/preload";

export async function attachSourceMaterialsForPdf(order) {
  const items = order.items || [];
  const quoteItemIds = items
    .filter((i) => i.sourceItemType === "QUOTE_ITEM")
    .map((i) => i.sourceItemId)
    .filter(Boolean);
  if (!quoteItemIds.length) {
    return {
      ...order,
      items: items.map((item) => ({ ...item, sourceMaterials: item.sourceMaterials || [] })),
    };
  }
  const materials = await prisma.quoteItemMaterial.findMany({
    where: { quoteItemId: { in: quoteItemIds } },
    include: {
      item: { select: { unitOfMeasure: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  const byItem = new Map();
  for (const mat of materials) {
    const list = byItem.get(mat.quoteItemId) || [];
    list.push({
      id: mat.id,
      descriptionSnapshot: mat.descriptionSnapshot,
      quantity: mat.quantity,
      unit: mat.unit || mat.item?.unitOfMeasure || null,
      dimensions: mat.dimensions,
      presentation: mat.presentation,
      supplierName: mat.supplier?.name || null,
    });
    byItem.set(mat.quoteItemId, list);
  }
  return {
    ...order,
    items: items.map((item) => ({
      ...item,
      sourceMaterials: byItem.get(item.sourceItemId) || item.sourceMaterials || [],
    })),
  };
}

export async function listProductionMaterials(request, productionOrderId) {
  const user = await requirePermission("purchase_orders.create");
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId },
    include: {
      quote: { select: { id: true, folio: true } },
      items: { select: { id: true, sourceItemId: true, sourceItemType: true, description: true } },
    },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");

  const quoteItemIds = (order.items || [])
    .filter((i) => i.sourceItemType === "QUOTE_ITEM")
    .map((i) => i.sourceItemId)
    .filter(Boolean);

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
  const available = materials.map((mat) => ({
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
  }));

  return jsonOk({
    productionOrderId: order.id,
    productionFolio: order.folio,
    quoteId: order.quoteId,
    quoteFolio: order.quote?.folio || null,
    materials: available,
  });
}

export function selectedMaterialsPayload(available, selectedIds, includeSalePrice) {
  return mapSelectedMaterials(available, selectedIds, { includeSalePrice });
}
