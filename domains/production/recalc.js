import { computeProgress, deriveOrderStatus } from "./progress";

const USER = { select: { id: true, name: true } };

// Vive aqui y no en activity.js para no cerrar el ciclo activity -> recalc -> activity:
// el include se evalua al cargar el modulo y la constante quedaria en TDZ.
export const PROCESS_USER_SELECT = {
  assignedToUser: USER,
  sessions: {
    where: { status: { in: ["RUNNING", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    take: 3,
    include: { user: USER },
  },
};

export const PRODUCTION_DETAIL_INCLUDE = {
  client: true,
  quote: { select: { id: true, folio: true, status: true } },
  directOrder: { select: { id: true, folio: true, status: true } },
  materialsReadyByUser: { select: { id: true, name: true } },
  attachments: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { createdByUser: USER },
  },
  incidents: {
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      reportedByUser: USER,
      assignedToUser: USER,
    },
  },
  extraMaterials: {
    orderBy: { occurredAt: "desc" },
    take: 50,
    include: {
      createdByUser: USER,
      catalogItem: { select: { id: true, sku: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
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
      completedByUser: USER,
      assignedToUser: USER,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdByUser: USER },
      },
      processes: {
        orderBy: { sortOrder: "asc" },
        include: {
          process: { select: { id: true, code: true, name: true, unit: true } },
          ...PROCESS_USER_SELECT,
        },
      },
      incidents: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          reportedByUser: USER,
          assignedToUser: USER,
          attachments: {
            select: {
              id: true,
              fileName: true,
              pathname: true,
              contentType: true,
              kind: true,
            },
          },
        },
      },
      extraMaterials: {
        orderBy: { occurredAt: "desc" },
        include: {
          createdByUser: USER,
          catalogItem: { select: { id: true, sku: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      },
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { createdByUser: USER },
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

  const updated = await tx.productionOrder.update({
    where: { id: productionOrderId },
    data: patch,
    include: PRODUCTION_DETAIL_INCLUDE,
  });

  if (nextStatus === "COMPLETED" && existing?.status !== "COMPLETED") {
    const { handbackPriceAfterProduction } = await import(
      "@/domains/quotes/after-production"
    );
    await handbackPriceAfterProduction(tx, updated, actorId);
  }

  return updated;
}
