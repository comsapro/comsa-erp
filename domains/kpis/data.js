import "server-only";
import { prisma } from "@/lib/db";
import {
  addDaysKey,
  dateColumnBounds,
  dayKey,
  keyToDate,
  timestampBounds,
} from "./periods";
import { num, resolveTrackingStatus } from "./calculations";
import { OPEN_INCIDENT_STATUSES } from "./constants";

// -----------------------------------------------------------------------------
// KPI 1 — Partidas del calendario de produccion
// -----------------------------------------------------------------------------

const OPEN_ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "REWORK"];

// tracking_status es nullable: NOT IN sobre NULL descartaria la fila en SQL.
const NOT_DONE_MANUAL = {
  OR: [{ trackingStatus: null }, { trackingStatus: { notIn: ["FINISHED", "RELEASED", "DELIVERED"] } }],
};

const TRACKING_INCLUDE = {
  assignedToUser: { select: { id: true, name: true } },
  qualityConfig: {
    select: { inspectionStatus: true, requestedQty: true, releasedQty: true },
  },
  incidents: {
    where: { status: { in: OPEN_INCIDENT_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      blocking: true,
      priority: true,
      reasonCode: true,
      createdAt: true,
      assignedToUser: { select: { id: true, name: true } },
    },
  },
  productionOrder: {
    select: {
      id: true,
      folio: true,
      status: true,
      estimatedDeliveryDate: true,
      client: { select: { id: true, commercialName: true } },
      quote: {
        select: { id: true, folio: true, seller: { select: { id: true, name: true } } },
      },
      directOrder: {
        select: { id: true, folio: true, seller: { select: { id: true, name: true } } },
      },
    },
  },
};

export function mapTrackingRow(item, today) {
  const order = item.productionOrder;
  const seller = order?.quote?.seller || order?.directOrder?.seller || null;
  const openIncidents = (item.incidents || []).map((i) => ({
    id: i.id,
    title: i.title,
    status: i.status,
    blocking: i.blocking,
    priority: i.priority,
    reasonCode: i.reasonCode,
    createdAt: i.createdAt,
    assignedTo: i.assignedToUser,
  }));
  const base = {
    id: item.id,
    productionOrderId: order?.id,
    project: order?.folio,
    quoteId: order?.quote?.id || null,
    quoteFolio: order?.quote?.folio || order?.directOrder?.folio || null,
    clientId: order?.client?.id || null,
    client: order?.client?.commercialName || "",
    position: item.position,
    description: item.description,
    quantity: num(item.quantity),
    completedQuantity: num(item.completedQuantity),
    status: item.status,
    priority: item.priority,
    trackingStatus: item.trackingStatus,
    deliveredAt: dayKey(item.deliveredAt),
    commitmentDate: dayKey(item.commitmentDate),
    plannedEndAt: dayKey(item.plannedEndAt),
    assignedToUserId: item.assignedToUser?.id || null,
    responsible: item.assignedToUser?.name || "Producción",
    sellerId: seller?.id || null,
    sellerName: seller?.name || null,
    openIncidents,
    openBlockingIncidents: openIncidents.filter((i) => i.blocking).length,
    quality: item.qualityConfig
      ? {
          inspectionStatus: item.qualityConfig.inspectionStatus,
          requestedQty: num(item.qualityConfig.requestedQty),
          releasedQty: num(item.qualityConfig.releasedQty),
        }
      : null,
  };
  return { ...base, tracking: resolveTrackingStatus(base, today) };
}

/**
 * Partidas relevantes para la junta: compromisos en la ventana, vencidos
 * abiertos y trabajos abiertos sin fecha compromiso.
 */
export async function loadTrackingRows({ windowFrom, windowTo, today }) {
  const items = await prisma.productionItem.findMany({
    where: {
      status: { not: "CANCELLED" },
      productionOrder: { status: { not: "CANCELLED" } },
      OR: [
        { commitmentDate: dateColumnBounds({ from: windowFrom, to: windowTo }) },
        {
          commitmentDate: { lt: keyToDate(windowFrom) },
          status: { not: "COMPLETED" },
          deliveredAt: null,
          AND: [NOT_DONE_MANUAL],
        },
        {
          commitmentDate: { lt: keyToDate(windowFrom) },
          status: "COMPLETED",
          deliveredAt: null,
          qualityConfig: { is: { inspectionStatus: { not: "CLOSED" } } },
          AND: [NOT_DONE_MANUAL],
        },
        {
          commitmentDate: null,
          status: { in: OPEN_ORDER_STATUSES },
          productionOrder: { status: { in: OPEN_ORDER_STATUSES } },
        },
        { incidents: { some: { blocking: true, status: { in: OPEN_INCIDENT_STATUSES } } } },
      ],
    },
    include: TRACKING_INCLUDE,
    orderBy: [{ commitmentDate: "asc" }, { position: "asc" }],
    take: 2000,
  });
  return items.map((item) => mapTrackingRow(item, today));
}

export async function loadTrackingRow(itemId, today) {
  const item = await prisma.productionItem.findFirst({
    where: { id: itemId },
    include: TRACKING_INCLUDE,
  });
  return item ? mapTrackingRow(item, today) : null;
}

// -----------------------------------------------------------------------------
// Facturas (KPI 2, 3 y 4)
// -----------------------------------------------------------------------------

export function mapInvoiceRow(inv) {
  const firstQuote = inv.quotes?.[0]?.quote || null;
  const client = inv.client || firstQuote?.client || null;
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    netAmount: num(inv.netAmount),
    invoiceDate: dayKey(inv.invoiceDate),
    sentAt: dayKey(inv.sentAt),
    receivedByClient: inv.receivedByClient,
    receptionDate: dayKey(inv.receptionDate),
    creditDays: inv.creditDays,
    dueDate: dayKey(inv.dueDate),
    paidAt: dayKey(inv.paidAt),
    sellerId: inv.sellerId,
    sellerName: inv.seller?.name || "",
    clientId: client?.id || inv.clientId || null,
    clientName: client?.commercialName || "",
    clientPoNumber: inv.clientPoNumber,
    quoteFolios: (inv.quotes || []).map((q) => q.quote?.folio).filter(Boolean).join(", "),
    quoteIds: (inv.quotes || []).map((q) => q.quote?.id).filter(Boolean),
    partidas: (inv.quotes || [])
      .flatMap((q) => (q.items || []).map((i) => i.quoteItem?.position))
      .filter((p) => p != null)
      .sort((a, b) => a - b)
      .join(", "),
  };
}

const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  netAmount: true,
  invoiceDate: true,
  sentAt: true,
  receivedByClient: true,
  receptionDate: true,
  creditDays: true,
  dueDate: true,
  paidAt: true,
  sellerId: true,
  clientId: true,
  clientPoNumber: true,
  seller: { select: { id: true, name: true } },
  client: { select: { id: true, commercialName: true } },
  quotes: {
    select: {
      quote: {
        select: { id: true, folio: true, client: { select: { id: true, commercialName: true } } },
      },
      items: { select: { quoteItem: { select: { position: true } } } },
    },
  },
};

/**
 * Facturas necesarias para el periodo y su historico: emitidas desde
 * `sinceKey` o aun abiertas (sin recepcion o sin pago).
 */
export async function loadInvoices({ sinceKey }) {
  const rows = await prisma.salesInvoice.findMany({
    where: {
      deletedAt: null,
      OR: [
        { invoiceDate: { gte: keyToDate(sinceKey) } },
        { receptionDate: null },
        { paidAt: null },
        { paidAt: { gte: keyToDate(sinceKey) } },
      ],
    },
    select: INVOICE_SELECT,
    orderBy: { invoiceDate: "asc" },
  });
  return rows.map(mapInvoiceRow);
}

export async function loadInvoicesInRange(range) {
  const rows = await prisma.salesInvoice.findMany({
    where: { deletedAt: null, invoiceDate: dateColumnBounds(range) },
    select: INVOICE_SELECT,
    orderBy: { invoiceDate: "asc" },
  });
  return rows.map(mapInvoiceRow);
}

// -----------------------------------------------------------------------------
// Metas de ventas
// -----------------------------------------------------------------------------

export async function loadGoals() {
  const goals = await prisma.salesGoal.findMany({
    where: { deletedAt: null },
    include: {
      sellers: { include: { seller: { select: { id: true, name: true } } } },
      teams: {
        include: {
          team: { select: { id: true, name: true, members: { select: { userId: true } } } },
        },
      },
    },
  });
  return goals.map((g) => {
    const sellerIds = g.sellers.map((s) => s.sellerId);
    const teamIds = g.teams.map((t) => t.teamId);
    const memberIds = new Set(sellerIds);
    for (const t of g.teams) for (const m of t.team?.members || []) memberIds.add(m.userId);
    const names = [
      ...g.teams.map((t) => t.team?.name).filter(Boolean),
      ...g.sellers.map((s) => s.seller?.name).filter(Boolean),
    ].join(" + ");
    return {
      id: g.id,
      period: g.period,
      periodKey: g.periodKey,
      amount: num(g.amount),
      amountIncludesTax: g.amountIncludesTax,
      label: g.label,
      sellerIds,
      teamIds,
      memberIds: [...memberIds],
      names,
    };
  });
}

// -----------------------------------------------------------------------------
// Calidad
// -----------------------------------------------------------------------------

export const QUALITY_ERROR_INCLUDE = {
  costs: { orderBy: { createdAt: "asc" } },
  operatorUser: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
  reworkOrder: { select: { id: true, folio: true, totalHours: true, status: true } },
  reworkSimple: { select: { id: true, hoursUsed: true } },
  productionOrder: {
    select: {
      id: true,
      folio: true,
      client: { select: { id: true, commercialName: true } },
      quote: { select: { id: true, folio: true } },
    },
  },
  productionItem: { select: { id: true, position: true, description: true } },
  quote: { select: { id: true, folio: true } },
};

export function mapQualityError(e, catalogs) {
  const cause = e.causeCode ? catalogs.ERROR_CAUSE[e.causeCode] : null;
  const area = e.areaCode ? catalogs.ERROR_AREA[e.areaCode] : null;
  const linkedReworkHours = e.reworkOrder
    ? num(e.reworkOrder.totalHours)
    : e.reworkSimple
      ? num(e.reworkSimple.hoursUsed)
      : 0;
  return {
    id: e.id,
    detectedAt: dayKey(e.detectedAt),
    detectionStage: e.detectionStage,
    causeCode: e.causeCode,
    causeLabel: cause?.label || null,
    areaCode: e.areaCode,
    areaLabel: area?.label || (e.areaText ? `${e.areaText} (sin clasificar)` : null),
    areaText: e.areaText,
    operatorUserId: e.operatorUserId,
    operatorName: e.operatorName,
    operatorLabel: e.operatorUser?.name || e.operatorName || "Sin operador",
    description: e.description,
    source: e.source,
    productionOrderId: e.productionOrderId,
    project: e.productionOrder?.folio || "",
    client: e.productionOrder?.client?.commercialName || "",
    quoteId: e.quote?.id || e.productionOrder?.quote?.id || null,
    quoteFolio: e.quote?.folio || e.productionOrder?.quote?.folio || null,
    productionItemId: e.productionItemId,
    position: e.productionItem?.position ?? null,
    itemDescription: e.productionItem?.description || null,
    reworkOrderId: e.reworkOrderId,
    reworkFolio: e.reworkOrder?.folio || null,
    reworkSimpleId: e.reworkSimpleId,
    linkedReworkHours,
    costs: (e.costs || []).map((c) => ({
      id: c.id,
      category: c.category,
      concept: c.concept,
      hours: c.hours == null ? null : num(c.hours),
      hourlyRate: c.hourlyRate == null ? null : num(c.hourlyRate),
      amount: num(c.amount),
      notes: c.notes,
    })),
    createdBy: e.createdByUser?.name || null,
    createdAt: e.createdAt,
  };
}

export async function loadQualityErrors(range, catalogs) {
  const rows = await prisma.qualityError.findMany({
    where: { deletedAt: null, detectedAt: dateColumnBounds(range) },
    include: QUALITY_ERROR_INCLUDE,
    orderBy: { detectedAt: "desc" },
  });
  return rows.map((e) => mapQualityError(e, catalogs));
}

/** Retrabajos y horas de retrabajo registrados en el periodo. */
export async function loadReworkTotals(range) {
  const ts = timestampBounds(range);
  const [orders, simples, hours] = await Promise.all([
    prisma.qualityReworkOrder.count({
      where: { requestedAt: ts, status: { not: "CANCELLED" } },
    }),
    prisma.qualityReworkSimple.aggregate({
      where: { createdAt: ts },
      _count: { _all: true },
      _sum: { hoursUsed: true },
    }),
    prisma.qualityReworkHour.aggregate({
      where: { createdAt: ts, reworkOrder: { status: { not: "CANCELLED" } } },
      _sum: { hours: true },
    }),
  ]);
  return {
    reworkCount: orders + simples._count._all,
    reworkHours: num(hours._sum.hours) + num(simples._sum.hoursUsed),
  };
}

export function historySinceKey(fromKey) {
  // Dos años antes del inicio para historicos y comparativos.
  return addDaysKey(fromKey, -730);
}
