import { withErrorHandling, jsonOk } from "@/lib/api/http";
import { requirePermission } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/permissions/errors";
import { toNumber } from "@/lib/quotes/calculations";

export const GET = withErrorHandling(async (_req, ctx) => {
  await requirePermission("production.view");
  const { id } = await ctx.params;

  const order = await prisma.productionOrder.findUnique({
    where: { id },
    select: { id: true, folio: true, items: { select: { id: true } } },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");

  const itemIds = order.items.map((i) => i.id);

  const [purchaseOrders, movements] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { productionOrderId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        folio: true,
        status: true,
        total: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        OR: [
          { referenceType: "PRODUCTION_ORDER", referenceId: id },
          ...(itemIds.length
            ? [{ referenceType: "PRODUCTION_ITEM", referenceId: { in: itemIds } }]
            : []),
        ],
      },
      orderBy: { movementDate: "desc" },
      take: 50,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { name: true } },
      },
    }),
  ]);

  const consumedMap = new Map();
  for (const m of movements) {
    if (m.movementType !== "EXIT") continue;
    const prev = consumedMap.get(m.itemId) || {
      itemId: m.itemId,
      sku: m.item?.sku,
      name: m.item?.name,
      quantity: 0,
    };
    prev.quantity += toNumber(m.quantity);
    consumedMap.set(m.itemId, prev);
  }

  return jsonOk({
    purchaseOrders,
    movements,
    consumedMaterials: Array.from(consumedMap.values()),
  });
});
