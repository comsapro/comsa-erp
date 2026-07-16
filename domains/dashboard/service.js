import "server-only";
import { prisma } from "@/lib/db";

const activeWhere = { deletedAt: null, status: "ACTIVE" };

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

export async function getRecentActivity(limit = 8) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}
