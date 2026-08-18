import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk } from "@/lib/api/http";
import { OPEN_INCIDENT_STATUSES } from "./constants";
import { itemHoursSummary } from "./process-rules";

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function getProductionDashboard(request) {
  await requirePermission("production.view");
  const url = new URL(request.url);
  const assignedTo = url.searchParams.get("assignedToUserId") || null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const today = startOfDay(new Date());
  const itemWhere = {
    status: { not: "CANCELLED" },
    productionOrder: { status: { not: "CANCELLED" } },
    ...(assignedTo ? { assignedToUserId: assignedTo } : {}),
  };

  const orderWhere = { status: { not: "CANCELLED" } };

  const [
    pendingOrders,
    plannedOrders,
    inProgressOrders,
    completedOrders,
    delayedOrders,
    itemsInProgress,
    delayedItems,
    urgentItems,
    openIncidents,
    processes,
    upcoming,
    recentActivity,
  ] = await Promise.all([
    prisma.productionOrder.count({ where: { status: "PENDING" } }),
    prisma.productionOrder.count({
      where: {
        status: "PENDING",
        items: { some: { plannedStartAt: { not: null } } },
      },
    }),
    prisma.productionOrder.count({ where: { status: "IN_PROGRESS" } }),
    prisma.productionOrder.count({ where: { status: "COMPLETED" } }),
    prisma.productionOrder.count({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        items: {
          some: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            commitmentDate: { lt: today },
          },
        },
      },
    }),
    prisma.productionItem.count({
      where: { ...itemWhere, status: { in: ["IN_PROGRESS", "REWORK"] } },
    }),
    prisma.productionItem.count({
      where: {
        ...itemWhere,
        status: { notIn: ["COMPLETED"] },
        commitmentDate: { lt: today },
      },
    }),
    prisma.productionItem.count({
      where: { ...itemWhere, priority: "URGENT", status: { not: "COMPLETED" } },
    }),
    prisma.productionIncident.count({
      where: { status: { in: OPEN_INCIDENT_STATUSES } },
    }),
    prisma.productionItemProcess.findMany({
      where: {
        status: { not: "REPLACED" },
        productionItem: itemWhere,
      },
      select: { quotedHours: true, expectedHours: true, realHours: true },
    }),
    prisma.productionItem.findMany({
      where: {
        ...itemWhere,
        status: { not: "COMPLETED" },
        commitmentDate: {
          gte: today,
          lte: addDays(today, 14),
        },
      },
      orderBy: { commitmentDate: "asc" },
      take: 12,
      include: {
        assignedToUser: { select: { id: true, name: true } },
        productionOrder: {
          select: {
            id: true,
            folio: true,
            client: { select: { commercialName: true } },
          },
        },
      },
    }),
    prisma.productionActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        createdByUser: { select: { name: true } },
        productionOrder: { select: { id: true, folio: true } },
      },
    }),
  ]);

  const hours = itemHoursSummary(processes);

  void from;
  void to;
  void orderWhere;

  const laterOrders = delayedOrders;

  return jsonOk({
    kpis: {
      pendingOrders,
      plannedOrders,
      inProgressOrders,
      delayedOrders: laterOrders,
      completedOrders,
      itemsInProgress,
      delayedItems,
      urgentItems,
      openIncidents,
      quotedHours: hours.quotedHours,
      expectedHours: hours.expectedHours,
      realHours: hours.realHours,
    },
    upcomingDeliveries: upcoming,
    recentActivity,
  });
}

export async function listAssignables() {
  await requirePermission("production.view");
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      roles: {
        some: {
          role: {
            name: { in: ["Produccion", "Supervisor", "Administrador"] },
          },
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
    take: 200,
  });
  return jsonOk(rows);
}
