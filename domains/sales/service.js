import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/permissions/errors";
import { toNumber } from "@/lib/quotes/calculations";
import { salesGoalSchema, salesInvoiceSchema, materialDecisionSchema } from "./schemas";
import {
  periodKeyFor,
  periodRange,
  SALES_GOAL_PERIODS,
} from "./constants";
import { goalAssignmentsOverlap } from "./goal-overlap";
import {
  canManageSalesGoals,
  canViewTeamSales,
  resolveSalesScope,
  sellerWhere,
  canAccessSellerId,
} from "./scope";
import { getCurrentUser, userHasPermission, userIsAdmin } from "@/lib/auth/session";
import { assertActiveUser, assertActiveUsers } from "@/domains/users/assert-active";

function parseMaterialsPage(request) {
  return parseListParams(request, {
    defaultSort: "createdAt",
    defaultOrder: "asc",
  });
}

async function purchasedMaterialIdSet(quoteIds) {
  if (!quoteIds.length) return new Set();
  const purchased = await prisma.purchaseOrderItem.findMany({
    where: {
      sourceType: "QUOTE_MATERIAL",
      sourceMaterialId: { not: null },
      purchaseOrder: {
        deletedAt: null,
        status: { not: "CANCELLED" },
        OR: [
          { quoteId: { in: quoteIds } },
          { productionOrder: { quoteId: { in: quoteIds } } },
        ],
      },
    },
    select: { sourceMaterialId: true },
    distinct: ["sourceMaterialId"],
  });
  return new Set(purchased.map((p) => p.sourceMaterialId).filter(Boolean));
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeForQuotePeriod(period) {
  const now = new Date();
  if (period === "general") return null;
  if (period === "weekly") {
    const from = startOfWeek(now);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (period === "monthly") {
    return periodRange("MONTHLY", periodKeyFor(SALES_GOAL_PERIODS.MONTHLY, now));
  }
  if (period === "quarterly") {
    return periodRange("QUARTERLY", periodKeyFor(SALES_GOAL_PERIODS.QUARTERLY, now));
  }
  if (period === "semiannual") {
    return periodRange("SEMIANNUAL", periodKeyFor(SALES_GOAL_PERIODS.SEMIANNUAL, now));
  }
  return periodRange("ANNUAL", periodKeyFor(SALES_GOAL_PERIODS.ANNUAL, now));
}

async function assertActiveTeams(teamIds = []) {
  if (!teamIds.length) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds }, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (teams.length !== teamIds.length) {
    throw new ValidationError("Solo se pueden asignar equipos activos");
  }
  return teams.map((t) => t.id);
}

async function assertNoOverlappingGoal({
  period,
  periodKey,
  teamIds,
  sellerIds,
  excludeId = null,
}) {
  const candidates = await prisma.salesGoal.findMany({
    where: {
      deletedAt: null,
      period,
      periodKey,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: {
      teams: { select: { teamId: true } },
      sellers: { select: { sellerId: true } },
    },
  });

  for (const goal of candidates) {
    if (goalAssignmentsOverlap(goal, teamIds, sellerIds)) {
      throw new ConflictError(
        "Ya existe una meta para ese equipo o vendedor en el periodo"
      );
    }
  }
}

async function sellerIdsForGoal(goal) {
  const ids = new Set((goal.sellers || []).map((s) => s.sellerId));
  for (const link of goal.teams || []) {
    const members = link.team?.members || [];
    for (const m of members) {
      if (m.userId) ids.add(m.userId);
      else if (m.user?.id) ids.add(m.user.id);
    }
  }
  return [...ids];
}

const GOAL_INCLUDE = {
  sellers: { include: { seller: { select: { id: true, name: true, email: true } } } },
  teams: {
    include: {
      team: {
        select: {
          id: true,
          name: true,
          members: { select: { userId: true } },
        },
      },
    },
  },
  createdByUser: { select: { id: true, name: true } },
  updatedByUser: { select: { id: true, name: true } },
};

async function activeGoalForScope(scope, date = new Date()) {
  const candidates = [
    SALES_GOAL_PERIODS.MONTHLY,
    SALES_GOAL_PERIODS.QUARTERLY,
    SALES_GOAL_PERIODS.SEMIANNUAL,
    SALES_GOAL_PERIODS.ANNUAL,
  ];

  for (const period of candidates) {
    const key = periodKeyFor(period, date);
    const scopeFilter = scope.sellerIds?.length
      ? {
          OR: [
            { sellers: { some: { sellerId: { in: scope.sellerIds } } } },
            {
              teams: {
                some: {
                  team: {
                    members: { some: { userId: { in: scope.sellerIds } } },
                  },
                },
              },
            },
          ],
        }
      : scope.sellerId
        ? {
            OR: [
              { sellers: { some: { sellerId: scope.sellerId } } },
              {
                teams: {
                  some: {
                    team: { members: { some: { userId: scope.sellerId } } },
                  },
                },
              },
            ],
          }
        : {};

    const goal = await prisma.salesGoal.findFirst({
      where: {
        deletedAt: null,
        period,
        periodKey: key,
        ...scopeFilter,
      },
      include: GOAL_INCLUDE,
    });
    if (goal) return goal;
  }
  return null;
}

export async function getSalesDashboard(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "general";
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });

  const sellFilter = sellerWhere(scope);
  const dateRange = rangeForQuotePeriod(period);
  const quoteDateFilter = dateRange
    ? { elaborationDate: { gte: dateRange.from, lte: dateRange.to } }
    : {};

  const baseQuoteWhere = {
    deletedAt: null,
    ...sellFilter,
  };

  const [
    draft,
    pendingApproval,
    inProduction,
    fabricated,
    goal,
    pendingPurchase,
    pendingReceipt,
    receivedCount,
    commitmentsThisWeek,
  ] = await Promise.all([
    prisma.quote.count({
      where: { ...baseQuoteWhere, ...quoteDateFilter, status: "DRAFT" },
    }),
    prisma.quote.count({
      where: {
        ...baseQuoteWhere,
        ...quoteDateFilter,
        status: "PENDING_APPROVAL",
      },
    }),
    prisma.quote.count({
      where: {
        ...baseQuoteWhere,
        ...quoteDateFilter,
        status: "IN_PRODUCTION",
      },
    }),
    prisma.quote.count({
      where: {
        ...baseQuoteWhere,
        ...quoteDateFilter,
        status: "IN_PRODUCTION",
        productionOrders: { some: { status: "COMPLETED" } },
      },
    }),
    activeGoalForScope(scope),
    countPendingPurchaseMaterials(scope),
    countPendingReceiptMaterials(scope),
    countReceivedMaterials(scope),
    countCommitmentsThisWeek(scope),
  ]);

  let soldAmount = 0;
  let goalMeta = null;
  if (goal) {
    const range = periodRange(goal.period, goal.periodKey);
    const sellerIds = await sellerIdsForGoal(goal);
    const invoices = await prisma.salesInvoice.aggregate({
      where: {
        deletedAt: null,
        ...(sellerIds.length ? { sellerId: { in: sellerIds } } : { sellerId: "__none__" }),
        invoiceDate: { gte: range.from, lte: range.to },
      },
      _sum: { netAmount: true },
    });
    soldAmount = toNumber(invoices._sum.netAmount);
    const amount = toNumber(goal.amount);
    const pct = amount > 0 ? Math.min(100, Math.round((soldAmount / amount) * 1000) / 10) : 0;
    goalMeta = {
      id: goal.id,
      period: goal.period,
      periodKey: goal.periodKey,
      amount,
      soldAmount,
      remaining: Math.max(0, amount - soldAmount),
      percent: pct,
      sellers: (goal.sellers || []).map((s) => s.seller),
      teams: (goal.teams || []).map((t) => ({
        id: t.team.id,
        name: t.team.name,
      })),
      createdAt: goal.createdAt,
      createdBy: goal.createdByUser,
      updatedAt: goal.updatedAt,
      updatedBy: goal.updatedByUser,
    };
  }

  return jsonOk({
    scope: {
      team: scope.team,
      sellerId: scope.sellerId,
    },
    goal: goalMeta,
    quotes: {
      period,
      draft,
      pendingApproval,
      inProduction,
      fabricated,
    },
    materials: {
      pendingPurchase,
      pendingReceipt,
      received: receivedCount,
    },
    commitmentsThisWeek,
  });
}

async function sellerQuoteIds(scope) {
  const quotes = await prisma.quote.findMany({
    where: { deletedAt: null, ...sellerWhere(scope) },
    select: { id: true },
  });
  return quotes.map((q) => q.id);
}

async function countPendingPurchaseMaterials(scope) {
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) return 0;

  const purchasedSet = await purchasedMaterialIdSet(quoteIds);
  const purchasedIds = [...purchasedSet];

  return prisma.quoteItemMaterial.count({
    where: {
      quoteItem: {
        status: "ACTIVE",
        quote: {
          id: { in: quoteIds },
          status: "IN_PRODUCTION",
          deletedAt: null,
        },
      },
      NOT: { purchaseDecision: { willPurchase: false } },
      ...(purchasedIds.length ? { id: { notIn: purchasedIds } } : {}),
    },
  });
}

async function countPendingReceiptMaterials(scope) {
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) return 0;

  const rows = await prisma.purchaseOrderItem.findMany({
    where: {
      sourceType: "QUOTE_MATERIAL",
      sourceMaterialId: { not: null },
      purchaseOrder: {
        deletedAt: null,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
        OR: [
          { quoteId: { in: quoteIds } },
          { productionOrder: { quoteId: { in: quoteIds } } },
        ],
      },
    },
    select: {
      quantity: true,
      receivedQuantity: true,
    },
  });

  return rows.filter(
    (r) => toNumber(r.receivedQuantity) < toNumber(r.quantity)
  ).length;
}

async function countReceivedMaterials(scope) {
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) return 0;

  return prisma.purchaseReceiptItem.count({
    where: {
      purchaseOrderItem: {
        purchaseOrder: {
          deletedAt: null,
          OR: [
            { quoteId: { in: quoteIds } },
            { productionOrder: { quoteId: { in: quoteIds } } },
          ],
        },
      },
    },
  });
}

async function countCommitmentsThisWeek(scope) {
  const from = startOfWeek();
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  return prisma.productionItem.count({
    where: {
      commitmentDate: { gte: from, lte: to },
      productionOrder: {
        status: { not: "CANCELLED" },
        quote: { deletedAt: null, ...sellerWhere(scope) },
      },
    },
  });
}

export async function listPendingPurchaseMaterials(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const params = parseMaterialsPage(request);
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) {
    return jsonOk(paginated([], 0, params));
  }

  const purchasedSet = await purchasedMaterialIdSet(quoteIds);
  const purchasedIds = [...purchasedSet];

  const where = {
    quoteItem: {
      status: "ACTIVE",
      quote: { id: { in: quoteIds }, status: "IN_PRODUCTION", deletedAt: null },
    },
    NOT: { purchaseDecision: { willPurchase: false } },
    ...(purchasedIds.length ? { id: { notIn: purchasedIds } } : {}),
  };

  const [total, materials] = await Promise.all([
    prisma.quoteItemMaterial.count({ where }),
    prisma.quoteItemMaterial.findMany({
      where,
      include: {
        purchaseDecision: true,
        quoteItem: {
          select: {
            id: true,
            position: true,
            description: true,
            quote: {
              select: {
                id: true,
                folio: true,
                productionOrders: {
                  where: { status: { not: "CANCELLED" } },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true, folio: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: params.skip,
      take: params.take,
    }),
  ]);

  const data = materials.map((m) => ({
    id: m.id,
    material: m.descriptionSnapshot,
    dimensions: m.dimensions,
    quantity: toNumber(m.quantity),
    unit: m.unit,
    willPurchase: m.purchaseDecision?.willPurchase ?? null,
    skipReason: m.purchaseDecision?.skipReason || null,
    observations: m.purchaseDecision?.observations || null,
    quoteItemId: m.quoteItem.id,
    quoteItemDescription: m.quoteItem.description,
    quoteItemPosition: m.quoteItem.position,
    quoteId: m.quoteItem.quote.id,
    quoteFolio: m.quoteItem.quote.folio,
    productionOrderId: m.quoteItem.quote.productionOrders[0]?.id || null,
    productionFolio: m.quoteItem.quote.productionOrders[0]?.folio || null,
  }));

  return jsonOk(paginated(data, total, params));
}

export async function listPendingReceiptMaterials(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const params = parseMaterialsPage(request);
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) {
    return jsonOk(paginated([], 0, params));
  }

  const rows = await prisma.purchaseOrderItem.findMany({
    where: {
      sourceType: "QUOTE_MATERIAL",
      sourceMaterialId: { not: null },
      purchaseOrder: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "DRAFT", "REJECTED"] },
        OR: [
          { quoteId: { in: quoteIds } },
          { productionOrder: { quoteId: { in: quoteIds } } },
        ],
      },
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          folio: true,
          requestDate: true,
          status: true,
          productionOrder: { select: { folio: true } },
          quote: { select: { folio: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const filtered = rows
    .filter((r) => toNumber(r.receivedQuantity) < toNumber(r.quantity))
    .map((r) => ({
      id: r.id,
      material: r.descriptionSnapshot,
      quantity: toNumber(r.quantity) - toNumber(r.receivedQuantity),
      orderedQuantity: toNumber(r.quantity),
      receivedQuantity: toNumber(r.receivedQuantity),
      purchaseOrderId: r.purchaseOrder.id,
      purchaseOrderFolio: r.purchaseOrder.folio,
      requestDate: r.purchaseOrder.requestDate,
      status: r.purchaseOrder.status,
      productionFolio: r.purchaseOrder.productionOrder?.folio || null,
      quoteFolio: r.purchaseOrder.quote?.folio || null,
    }));

  const total = filtered.length;
  const data = filtered.slice(params.skip, params.skip + params.take);
  return jsonOk(paginated(data, total, params));
}

export async function listReceivedMaterials(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const params = parseMaterialsPage(request);
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });
  const quoteIds = await sellerQuoteIds(scope);
  if (!quoteIds.length) {
    return jsonOk(paginated([], 0, params));
  }

  const where = {
    purchaseOrderItem: {
      purchaseOrder: {
        deletedAt: null,
        OR: [
          { quoteId: { in: quoteIds } },
          { productionOrder: { quoteId: { in: quoteIds } } },
        ],
      },
    },
  };

  const [total, rows] = await Promise.all([
    prisma.purchaseReceiptItem.count({ where }),
    prisma.purchaseReceiptItem.findMany({
      where,
      include: {
        purchaseReceipt: {
          select: {
            folio: true,
            receiptDate: true,
            createdAt: true,
            receivedByUser: { select: { id: true, name: true } },
          },
        },
        purchaseOrderItem: {
          select: {
            descriptionSnapshot: true,
            purchaseOrder: {
              select: {
                folio: true,
                productionOrder: { select: { folio: true } },
                quote: { select: { folio: true } },
              },
            },
          },
        },
        item: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    material: r.purchaseOrderItem.descriptionSnapshot || r.item?.name,
    quantity: toNumber(r.receivedQuantity),
    purchaseOrderFolio: r.purchaseOrderItem.purchaseOrder.folio,
    productionFolio: r.purchaseOrderItem.purchaseOrder.productionOrder?.folio || null,
    quoteFolio: r.purchaseOrderItem.purchaseOrder.quote?.folio || null,
    receiptFolio: r.purchaseReceipt.folio,
    receiptDate: r.purchaseReceipt.receiptDate,
    receivedAt: r.purchaseReceipt.createdAt,
    receivedBy: r.purchaseReceipt.receivedByUser,
  }));

  return jsonOk(paginated(data, total, params));
}

export async function upsertMaterialDecision(request) {
  await requirePermission("sales.view");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const body = await request.json();
  const data = materialDecisionSchema.parse(body);

  const material = await prisma.quoteItemMaterial.findFirst({
    where: { id: data.quoteItemMaterialId },
    include: {
      quoteItem: {
        select: {
          quote: { select: { sellerId: true, status: true, deletedAt: true } },
        },
      },
    },
  });
  if (!material || material.quoteItem.quote.deletedAt) {
    throw new NotFoundError("Material no encontrado");
  }
  const scope = await resolveSalesScope(request, {});
  if (!canAccessSellerId(scope, material.quoteItem.quote.sellerId)) {
    throw new ForbiddenError("No puedes decidir sobre materiales de otro vendedor");
  }

  const record = await prisma.materialPurchaseDecision.upsert({
    where: { quoteItemMaterialId: data.quoteItemMaterialId },
    create: {
      quoteItemMaterialId: data.quoteItemMaterialId,
      willPurchase: data.willPurchase,
      skipReason: data.willPurchase ? null : data.skipReason,
      observations: data.observations || null,
      decidedBy: actor.id,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
    update: {
      willPurchase: data.willPurchase,
      skipReason: data.willPurchase ? null : data.skipReason,
      observations: data.observations || null,
      decidedBy: actor.id,
      decidedAt: new Date(),
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "MaterialPurchaseDecision",
    entityId: record.id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: record,
  });

  return jsonOk(record);
}

export async function listSalesGoals(request) {
  await requirePermission("sales.manage_goals");
  const rows = await prisma.salesGoal.findMany({
    where: { deletedAt: null },
    include: GOAL_INCLUDE,
    orderBy: [{ periodKey: "desc" }, { createdAt: "desc" }],
  });
  return jsonOk({ data: rows });
}

export async function createSalesGoal(request) {
  await requirePermission("sales.manage_goals");
  const actor = await getActor(request);
  const body = await request.json();
  const data = salesGoalSchema.parse(body);

  const sellerIds = await assertActiveUsers(data.sellerIds || [], "Vendedor");
  const teamIds = await assertActiveTeams(data.teamIds || []);

  await assertNoOverlappingGoal({
    period: data.period,
    periodKey: data.periodKey,
    teamIds,
    sellerIds,
  });

  const record = await prisma.salesGoal.create({
    data: {
      period: data.period,
      periodKey: data.periodKey,
      amount: data.amount,
      label: data.label || null,
      createdBy: actor.id,
      updatedBy: actor.id,
      sellers: {
        create: sellerIds.map((sellerId) => ({ sellerId })),
      },
      teams: {
        create: teamIds.map((teamId) => ({ teamId })),
      },
    },
    include: GOAL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesGoal",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function updateSalesGoal(request, id) {
  await requirePermission("sales.manage_goals");
  const actor = await getActor(request);
  const body = await request.json();
  const data = salesGoalSchema.parse(body);

  const existing = await prisma.salesGoal.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Meta no encontrada");

  const sellerIds = await assertActiveUsers(data.sellerIds || [], "Vendedor");
  const teamIds = await assertActiveTeams(data.teamIds || []);

  await assertNoOverlappingGoal({
    period: data.period,
    periodKey: data.periodKey,
    teamIds,
    sellerIds,
    excludeId: id,
  });

  const record = await prisma.$transaction(async (tx) => {
    await tx.salesGoalSeller.deleteMany({ where: { salesGoalId: id } });
    await tx.salesGoalTeam.deleteMany({ where: { salesGoalId: id } });
    return tx.salesGoal.update({
      where: { id },
      data: {
        period: data.period,
        periodKey: data.periodKey,
        amount: data.amount,
        label: data.label || null,
        updatedBy: actor.id,
        sellers: {
          create: sellerIds.map((sellerId) => ({ sellerId })),
        },
        teams: {
          create: teamIds.map((teamId) => ({ teamId })),
        },
      },
      include: GOAL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesGoal",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function listSalesInvoices(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });
  const pendingReception = url.searchParams.get("pendingReception") === "1";

  const rows = await prisma.salesInvoice.findMany({
    where: {
      deletedAt: null,
      ...sellerWhere(scope),
      ...(pendingReception ? { receivedByClient: false } : {}),
    },
    include: {
      seller: { select: { id: true, name: true } },
      quotes: {
        include: {
          quote: { select: { id: true, folio: true } },
          items: {
            include: {
              quoteItem: { select: { id: true, position: true, description: true } },
            },
          },
        },
      },
    },
    orderBy: { invoiceDate: "desc" },
    take: 200,
  });

  return jsonOk({ data: rows });
}

export async function createSalesInvoice(request) {
  await requirePermission("sales.create_invoice");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const body = await request.json();
  const data = salesInvoiceSchema.parse(body);

  const sellerId =
    canViewTeamSales(user) && data.sellerId ? data.sellerId : user.id;
  await assertActiveUser(sellerId, "Vendedor");

  const duplicate = await prisma.salesInvoice.findFirst({
    where: {
      invoiceNumber: { equals: data.invoiceNumber.trim(), mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (duplicate) {
    throw new ConflictError("Ya existe una factura con ese número");
  }

  const quoteLinks = data.quotes || [];
  if (!quoteLinks.length) {
    if (!userIsAdmin(user)) {
      throw new ForbiddenError(
        "Solo administradores pueden registrar facturas sin cotización ni partidas"
      );
    }
  } else {
    const invoiceScope = await resolveSalesScope(request, {});
    for (const link of quoteLinks) {
      const quote = await prisma.quote.findFirst({
        where: { id: link.quoteId, deletedAt: null },
        include: { items: { where: { status: "ACTIVE" }, select: { id: true } } },
      });
      if (!quote) throw new NotFoundError(`Cotización no encontrada: ${link.quoteId}`);
      if (!canAccessSellerId(invoiceScope, quote.sellerId)) {
        throw new ForbiddenError("No puedes facturar cotizaciones de otro vendedor");
      }
      const allowed = new Set(quote.items.map((i) => i.id));
      for (const itemId of link.quoteItemIds) {
        if (!allowed.has(itemId)) {
          throw new ValidationError("Partida no pertenece a la cotización seleccionada");
        }
      }
    }
  }

  const record = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: data.invoiceNumber.trim(),
      netAmount: data.netAmount,
      invoiceDate: data.invoiceDate,
      sellerId,
      clientPoNumber: data.clientPoNumber.trim(),
      receivedByClient: data.receivedByClient,
      receptionDate: data.receivedByClient ? data.receptionDate : null,
      notes: data.notes || null,
      createdBy: actor.id,
      updatedBy: actor.id,
      quotes: quoteLinks.length
        ? {
            create: quoteLinks.map((link) => ({
              quoteId: link.quoteId,
              items: {
                create: link.quoteItemIds.map((quoteItemId) => ({ quoteItemId })),
              },
            })),
          }
        : undefined,
    },
    include: {
      seller: { select: { id: true, name: true } },
      quotes: {
        include: {
          quote: { select: { folio: true } },
          items: true,
        },
      },
    },
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesInvoice",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function listSalesCommitments(request) {
  await requirePermission("sales.view");
  const url = new URL(request.url);
  const scope = await resolveSalesScope(request, {
    sellerIdParam: url.searchParams.get("sellerId"),
  });
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const items = await prisma.productionItem.findMany({
    where: {
      commitmentDate: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
        not: null,
      },
      productionOrder: {
        status: { not: "CANCELLED" },
        quote: { deletedAt: null, ...sellerWhere(scope) },
      },
    },
    include: {
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          progressPercentage: true,
          client: { select: { commercialName: true } },
          quote: { select: { id: true, folio: true, sellerId: true } },
        },
      },
    },
    orderBy: { commitmentDate: "asc" },
  });

  const data = items.map((item) => ({
    id: item.id,
    commitmentDate: item.commitmentDate,
    description: item.description,
    position: item.position,
    status: item.status,
    quantity: toNumber(item.quantity),
    completedQuantity: toNumber(item.completedQuantity),
    progressPercentage: toNumber(item.productionOrder.progressPercentage),
    productionOrderId: item.productionOrder.id,
    productionFolio: item.productionOrder.folio,
    productionStatus: item.productionOrder.status,
    client: item.productionOrder.client?.commercialName || "",
    quoteId: item.productionOrder.quote?.id || null,
    quoteFolio: item.productionOrder.quote?.folio || null,
  }));

  return jsonOk({ data });
}

export async function updateCommitmentDate(request, productionItemId) {
  await requirePermission("sales.edit_commitment");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const body = await request.json();
  const { commitmentDateSchema } = await import("./schemas");
  const data = commitmentDateSchema.parse(body);

  const item = await prisma.productionItem.findFirst({
    where: { id: productionItemId },
    include: {
      productionOrder: {
        select: {
          id: true,
          quote: { select: { sellerId: true } },
        },
      },
    },
  });
  if (!item) throw new NotFoundError("Partida de producción no encontrada");
  const commitmentScope = await resolveSalesScope(request, {});
  if (!canAccessSellerId(commitmentScope, item.productionOrder.quote?.sellerId)) {
    throw new ForbiddenError("No puedes editar compromisos de otro vendedor");
  }

  const previous = item.commitmentDate;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.productionItem.update({
      where: { id: productionItemId },
      data: {
        commitmentDate: data.commitmentDate,
        updatedBy: actor.id,
      },
    });
    await tx.productionScheduleChange.create({
      data: {
        productionItemId,
        previousCommitmentDate: previous,
        newCommitmentDate: data.commitmentDate,
        reason: data.reason || "Ajuste de fecha compromiso (Ventas)",
        createdBy: actor.id,
      },
    });
    return row;
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "ProductionItem",
    entityId: productionItemId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { commitmentDate: previous },
    newData: { commitmentDate: updated.commitmentDate },
  });

  return jsonOk(updated);
}

export { canManageSalesGoals, canViewTeamSales, userHasPermission };
