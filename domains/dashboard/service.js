import "server-only";
import { prisma } from "@/lib/db";

const activeWhere = { deletedAt: null, status: "ACTIVE" };

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Conteos de entidades activas para las tarjetas del dashboard.
export async function getDashboardStats() {
  const [users, clients, suppliers, items, warehouses, categories] =
    await Promise.all([
      prisma.user.count({ where: activeWhere }),
      prisma.client.count({ where: activeWhere }),
      prisma.supplier.count({ where: activeWhere }),
      prisma.item.count({ where: activeWhere }),
      prisma.warehouse.count({ where: activeWhere }),
      prisma.productCategory.count({ where: activeWhere }),
    ]);

  return { users, clients, suppliers, items, warehouses, categories };
}

export async function getStage2DashboardStats() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const today = startOfDay(now);
  const inSevenDays = addDays(today, 7);

  const [
    draftQuotes,
    pendingQuotes,
    approvedQuotes,
    rejectedQuotes,
    quotedThisMonth,
    approvedThisMonth,
    directOrdersPending,
    productionInProgress,
    productionPending,
    productionCompleted,
    quotesNearValidity,
  ] = await Promise.all([
    prisma.quote.count({ where: { deletedAt: null, status: "DRAFT" } }),
    prisma.quote.count({
      where: { deletedAt: null, status: "PENDING_APPROVAL" },
    }),
    prisma.quote.count({ where: { deletedAt: null, status: "APPROVED" } }),
    prisma.quote.count({ where: { deletedAt: null, status: "REJECTED" } }),
    prisma.quote.aggregate({
      where: {
        deletedAt: null,
        elaborationDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { total: true },
    }),
    prisma.quote.aggregate({
      where: {
        deletedAt: null,
        status: { in: ["APPROVED", "IN_PRODUCTION"] },
        approvedAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { total: true },
    }),
    prisma.directOrder.count({
      where: { deletedAt: null, status: "PENDING_APPROVAL" },
    }),
    prisma.productionOrder.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.productionOrder.count({ where: { status: "PENDING" } }),
    prisma.productionOrder.count({ where: { status: "COMPLETED" } }),
    prisma.quote.count({
      where: {
        deletedAt: null,
        status: { in: ["APPROVED", "PENDING_APPROVAL"] },
        validUntil: { gte: today, lte: inSevenDays },
      },
    }),
  ]);

  return {
    draftQuotes,
    pendingQuotes,
    approvedQuotes,
    rejectedQuotes,
    quotedThisMonth: Number(quotedThisMonth._sum.total || 0),
    approvedThisMonth: Number(approvedThisMonth._sum.total || 0),
    directOrdersPending,
    productionInProgress,
    productionPending,
    productionCompleted,
    quotesNearValidity,
  };
}

export async function getRecentActivity(limit = 8) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function getRecentCommercialActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { module: { in: ["quotes", "direct_orders"] } },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function getRecentProductionActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { module: "production" },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function getStage3DashboardStats() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    productionPending,
    poPendingApproval,
    poApproved,
    poPartial,
    poCompleted,
    purchasedThisMonth,
    entriesThisMonth,
    exitsThisMonth,
    lowStockRows,
    recentMovements,
    stockByWarehouse,
  ] = await Promise.all([
    prisma.productionOrder.count({ where: { status: "PENDING" } }),
    prisma.purchaseOrder.count({
      where: { deletedAt: null, status: "PENDING_APPROVAL" },
    }),
    prisma.purchaseOrder.count({
      where: { deletedAt: null, status: "APPROVED" },
    }),
    prisma.purchaseOrder.count({
      where: { deletedAt: null, status: "PARTIALLY_RECEIVED" },
    }),
    prisma.purchaseOrder.count({
      where: { deletedAt: null, status: "COMPLETED" },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        deletedAt: null,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "COMPLETED"] },
        requestDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { total: true },
    }),
    prisma.inventoryMovement.count({
      where: {
        movementType: { in: ["ENTRY", "ADJUSTMENT_IN", "TRANSFER_IN"] },
        movementDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.inventoryMovement.count({
      where: {
        movementType: { in: ["EXIT", "ADJUSTMENT_OUT", "TRANSFER_OUT"] },
        movementDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.inventoryStock.findMany({
      where: {
        item: { deletedAt: null, isInventoryControlled: true },
        warehouse: { deletedAt: null },
      },
      include: {
        item: { select: { minimumStock: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        item: { select: { sku: true, name: true } },
        warehouse: { select: { name: true } },
        createdByUser: { select: { name: true } },
      },
    }),
    prisma.inventoryStock.groupBy({
      by: ["warehouseId"],
      _sum: { quantity: true, availableQuantity: true },
      _count: { _all: true },
    }),
  ]);

  const lowStockAlerts = lowStockRows.filter(
    (r) => Number(r.availableQuantity) <= Number(r.item.minimumStock)
  ).length;

  const warehouses = await prisma.warehouse.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  const whMap = Object.fromEntries(warehouses.map((w) => [w.id, w]));

  return {
    productionPending,
    poPendingApproval,
    poApproved,
    poPartial,
    poCompleted,
    purchasedThisMonth: Number(purchasedThisMonth._sum.total || 0),
    entriesThisMonth,
    exitsThisMonth,
    lowStockAlerts,
    recentMovements,
    stockByWarehouse: stockByWarehouse.map((g) => ({
      warehouseId: g.warehouseId,
      warehouse: whMap[g.warehouseId] || null,
      quantity: Number(g._sum.quantity || 0),
      availableQuantity: Number(g._sum.availableQuantity || 0),
      itemCount: g._count._all,
    })),
  };
}

export async function getRecentInventoryActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { module: { in: ["inventory", "purchase_orders"] } },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}
