import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf/helpers";
import {
  buildDimensionalControlModel,
  buildWorkOrderModel,
  drawDimensionalControl,
  drawWorkOrder,
  PDF_OPTIONS,
} from "@/lib/pdf/production-docs";
import { PRODUCTION_DETAIL_INCLUDE } from "./recalc";
import { attachSourceMaterialsForPdf } from "./materials";
import { operatorNames } from "./process-rules";

// Las observaciones que el formato imprime son las que el vendedor dejo en el origen;
// si produccion ya capturo observaciones propias, esas tienen prioridad.
async function loadSellerObservations(item) {
  if (item.observations) return item.observations;
  if (!item.sourceItemId) return "";
  if (item.sourceItemType === "QUOTE_ITEM") {
    const quoteItem = await prisma.quoteItem.findUnique({
      where: { id: item.sourceItemId },
      select: { clientObservations: true, internalObservations: true },
    });
    return quoteItem?.clientObservations || quoteItem?.internalObservations || "";
  }
  if (item.sourceItemType === "DIRECT_ORDER_ITEM") {
    const directItem = await prisma.directOrderItem.findUnique({
      where: { id: item.sourceItemId },
      select: { observations: true },
    });
    return directItem?.observations || "";
  }
  return "";
}

// Las sesiones del include de detalle vienen filtradas a las activas, asi que para el
// formato se consultan todas las del item y se ordenan por inicio.
async function loadOperators(item) {
  const sessions = await prisma.productionTimeSession.findMany({
    where: { productionItemId: item.id },
    orderBy: { startedAt: "asc" },
    select: { user: { select: { name: true } } },
  });
  return operatorNames(
    item,
    sessions.map((session) => session.user?.name)
  );
}

async function loadOrderItem(orderId, itemId) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: {
      ...PRODUCTION_DETAIL_INCLUDE,
      quote: {
        select: {
          id: true,
          folio: true,
          status: true,
          requestDate: true,
          seller: { select: { id: true, name: true } },
        },
      },
      directOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          requestDate: true,
          observations: true,
          seller: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  const withMaterials = await attachSourceMaterialsForPdf(order);
  const itemWithMats = (withMaterials.items || []).find((i) => i.id === itemId) || item;
  const [sellerObservations, operators] = await Promise.all([
    loadSellerObservations(itemWithMats),
    loadOperators(itemWithMats),
  ]);
  return {
    order: withMaterials,
    item: { ...itemWithMats, sellerObservations, operators },
  };
}

export async function dimensionalControlPdf(request, orderId, itemId) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const { order, item } = await loadOrderItem(orderId, itemId);
  const model = buildDimensionalControlModel(order, item);
  const buffer = await buildPdfBuffer((doc) => drawDimensionalControl(doc, model), PDF_OPTIONS);
  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { type: "DIMENSIONAL_CONTROL", itemId, folio: order.folio },
  });
  return pdfResponse(buffer, `control-dimensional-${order.folio}-${item.position}.pdf`);
}

export async function getWorkOrderPrintModel(orderId, itemId) {
  await requirePermission("production.print");
  const { order, item } = await loadOrderItem(orderId, itemId);
  return { order, item, model: buildWorkOrderModel(order, item) };
}

export async function workOrderPdf(request, orderId, itemId) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const { order, item } = await loadOrderItem(orderId, itemId);
  const model = buildWorkOrderModel(order, item);
  const buffer = await buildPdfBuffer((doc) => drawWorkOrder(doc, model), PDF_OPTIONS);
  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { type: "WORK_ORDER", itemId, folio: order.folio },
  });
  return pdfResponse(buffer, `orden-trabajo-${order.folio}-${item.position}.pdf`, {
    disposition: "inline",
  });
}

export async function requireItemId(searchParams) {
  const itemId = searchParams.get("itemId");
  if (!itemId) throw new ValidationError("itemId es obligatorio");
  return itemId;
}
