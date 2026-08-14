import { computeProgress, deriveOrderStatus } from "./progress";

export const PRODUCTION_DETAIL_INCLUDE = {
  client: true,
  quote: { select: { id: true, folio: true, status: true } },
  directOrder: { select: { id: true, folio: true, status: true } },
  materialsReadyByUser: { select: { id: true, name: true } },
  attachments: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
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
      processes: {
        orderBy: { sortOrder: "asc" },
        include: {
          process: { select: { id: true, code: true, name: true, unit: true } },
        },
      },
    },
  },
};

export function getDetailInclude() {
  return PRODUCTION_DETAIL_INCLUDE;
}

export async function recalculateProductionState(tx, productionOrderId, actorId = null) {
  const items = await tx.productionItem.findMany({
    where: { productionOrderId },
  });
  const existing = await tx.productionOrder.findFirst({
    where: { id: productionOrderId },
    select: { status: true, startedAt: true, completedAt: true },
  });
  const progress = computeProgress(items);
  const nextStatus = deriveOrderStatus(existing?.status, items);
  const patch = {
    ...progress,
    status: nextStatus,
  };
  if (actorId) patch.updatedBy = actorId;
  if (nextStatus === "IN_PROGRESS" && existing?.status === "PENDING") {
    patch.startedAt = existing.startedAt || new Date();
  }
  if (nextStatus === "COMPLETED" && existing?.status !== "COMPLETED") {
    patch.completedAt = new Date();
  }
  if (nextStatus === "IN_PROGRESS" && existing?.status === "COMPLETED") {
    patch.completedAt = existing.completedAt;
  }

  return tx.productionOrder.update({
    where: { id: productionOrderId },
    data: patch,
    include: PRODUCTION_DETAIL_INCLUDE,
  });
}
