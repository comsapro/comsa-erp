import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import { QUALITY_ERROR_INCLUDE, mapInvoiceRow, mapQualityError, mapTrackingRow } from "./data";
import { errorCost, num, round } from "./calculations";
import { getCatalogMaps, getKpiSettings } from "./settings";
import { todayKey } from "./periods";
import { INCIDENT_STATUS_LABELS } from "./constants";

/**
 * Vista conectada de un proyecto (orden de produccion): cuanto se cotizo,
 * facturo, compro, cuantas horas se usaron, que problemas hubo, cuanto
 * costaron los errores y cuanto se ha cobrado.
 */
export async function getProjectOverview(request, orderId) {
  await requirePermission("kpis.view");
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: {
      client: { select: { id: true, commercialName: true } },
      quote: {
        select: {
          id: true,
          folio: true,
          total: true,
          subtotal: true,
          costTotal: true,
          materialsTotal: true,
          manufacturingTotal: true,
          currency: true,
          purchaseOrder: true,
          seller: { select: { id: true, name: true } },
        },
      },
      directOrder: { select: { id: true, folio: true, seller: { select: { id: true, name: true } } } },
    },
  });
  if (!order) throw new NotFoundError("Proyecto no encontrado");

  const today = todayKey();
  const [items, purchaseOrders, invoiceLinks, incidents, errors, reworkOrders, reworkSimples, catalogs, settings] =
    await Promise.all([
      prisma.productionItem.findMany({
        where: { productionOrderId: orderId },
        orderBy: { position: "asc" },
        include: {
          assignedToUser: { select: { id: true, name: true } },
          qualityConfig: { select: { inspectionStatus: true, requestedQty: true, releasedQty: true } },
          incidents: {
            where: { status: { in: ["OPEN", "IN_REVIEW"] } },
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
          processes: {
            where: { status: { not: "REPLACED" } },
            select: { quotedHours: true, expectedHours: true, realHours: true },
          },
          productionOrder: {
            select: {
              id: true,
              folio: true,
              status: true,
              client: { select: { id: true, commercialName: true } },
              quote: { select: { id: true, folio: true, seller: { select: { id: true, name: true } } } },
              directOrder: { select: { id: true, folio: true, seller: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] },
          OR: [{ productionOrderId: orderId }, ...(order.quoteId ? [{ quoteId: order.quoteId }] : [])],
        },
        select: {
          id: true,
          folio: true,
          status: true,
          total: true,
          requestDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { requestDate: "asc" },
      }),
      order.quoteId
        ? prisma.salesInvoice.findMany({
            where: { deletedAt: null, quotes: { some: { quoteId: order.quoteId } } },
            select: {
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
                  quote: { select: { id: true, folio: true, client: { select: { id: true, commercialName: true } } } },
                  items: { select: { quoteItem: { select: { position: true } } } },
                },
              },
            },
            orderBy: { invoiceDate: "asc" },
          })
        : Promise.resolve([]),
      prisma.productionIncident.findMany({
        where: { productionOrderId: orderId },
        orderBy: { createdAt: "desc" },
        include: {
          assignedToUser: { select: { id: true, name: true } },
          productionItem: { select: { position: true } },
        },
      }),
      prisma.qualityError.findMany({
        where: { productionOrderId: orderId, deletedAt: null },
        include: QUALITY_ERROR_INCLUDE,
        orderBy: { detectedAt: "desc" },
      }),
      prisma.qualityReworkOrder.findMany({
        where: { productionOrderId: orderId, status: { not: "CANCELLED" } },
        select: { totalHours: true },
      }),
      prisma.qualityReworkSimple.findMany({
        where: { productionOrderId: orderId },
        select: { hoursUsed: true },
      }),
      getCatalogMaps(),
      getKpiSettings(),
    ]);

  const invoices = invoiceLinks.map(mapInvoiceRow);
  const mappedErrors = errors.map((e) => {
    const m = mapQualityError(e, catalogs);
    return { ...m, cost: errorCost(m, settings.laborHourRate) };
  });
  const hours = items
    .flatMap((i) => i.processes)
    .reduce(
      (acc, p) => ({
        quoted: acc.quoted + num(p.quotedHours),
        expected: acc.expected + num(p.expectedHours),
        real: acc.real + num(p.realHours),
      }),
      { quoted: 0, expected: 0, real: 0 }
    );
  const billed = invoices.reduce((s, i) => s + i.netAmount, 0);
  const collected = invoices.filter((i) => i.paidAt).reduce((s, i) => s + i.netAmount, 0);
  const purchased = purchaseOrders.reduce((s, p) => s + num(p.total), 0);
  const errorsCost = mappedErrors.reduce((s, e) => s + e.cost.total, 0);
  const reworkHours =
    reworkOrders.reduce((s, r) => s + num(r.totalHours), 0) +
    reworkSimples.reduce((s, r) => s + num(r.hoursUsed), 0);

  return jsonOk({
    order: {
      id: order.id,
      folio: order.folio,
      status: order.status,
      client: order.client,
      approvalDate: order.approvalDate,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      progressPercentage: num(order.progressPercentage),
      seller: order.quote?.seller || order.directOrder?.seller || null,
      quote: order.quote
        ? {
            id: order.quote.id,
            folio: order.quote.folio,
            purchaseOrder: order.quote.purchaseOrder,
            currency: order.quote.currency,
          }
        : null,
      directOrder: order.directOrder ? { id: order.directOrder.id, folio: order.directOrder.folio } : null,
    },
    money: {
      quoted: round(num(order.quote?.total)),
      quotedCost: round(num(order.quote?.costTotal)),
      quotedMaterials: round(num(order.quote?.materialsTotal)),
      billed: round(billed),
      collected: round(collected),
      pendingCollection: round(billed - collected),
      purchased: round(purchased),
      errorsCost: round(errorsCost),
    },
    hours: {
      quoted: round(hours.quoted, 2),
      expected: round(hours.expected, 2),
      real: round(hours.real, 2),
      rework: round(reworkHours, 2),
    },
    items: items.map((i) => {
      const row = mapTrackingRow(i, today);
      const ph = i.processes.reduce(
        (acc, p) => ({ quoted: acc.quoted + num(p.quotedHours), real: acc.real + num(p.realHours) }),
        { quoted: 0, real: 0 }
      );
      return { ...row, quotedHours: round(ph.quoted, 2), realHours: round(ph.real, 2) };
    }),
    purchaseOrders: purchaseOrders.map((p) => ({ ...p, total: num(p.total) })),
    invoices,
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      statusLabel: INCIDENT_STATUS_LABELS[i.status],
      priority: i.priority,
      blocking: i.blocking,
      createdAt: i.createdAt,
      resolvedAt: i.resolvedAt,
      position: i.productionItem?.position ?? null,
      assignedTo: i.assignedToUser,
    })),
    errors: mappedErrors,
  });
}
