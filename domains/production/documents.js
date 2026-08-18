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
} from "@/lib/pdf/production-docs";
import { PRODUCTION_DETAIL_INCLUDE } from "./recalc";
import { attachSourceMaterialsForPdf } from "./materials";

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
          seller: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const item = (order.items || []).find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item de produccion no encontrado");
  const withMaterials = await attachSourceMaterialsForPdf(order);
  const itemWithMats = (withMaterials.items || []).find((i) => i.id === itemId);
  return { order: withMaterials, item: itemWithMats || item };
}

export async function dimensionalControlPdf(request, orderId, itemId) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const { order, item } = await loadOrderItem(orderId, itemId);
  const model = buildDimensionalControlModel(order, item);
  const buffer = await buildPdfBuffer((doc) => drawDimensionalControl(doc, model));
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

export async function workOrderPdf(request, orderId, itemId) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const { order, item } = await loadOrderItem(orderId, itemId);
  const origin =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const orderUrl = `${origin.replace(/\/$/, "")}/produccion/${orderId}`;
  let qrPng = null;
  try {
    const QRCode = (await import("qrcode")).default;
    qrPng = await QRCode.toBuffer(orderUrl, { type: "png", margin: 1, width: 160 });
  } catch {
    qrPng = null;
  }
  const model = buildWorkOrderModel({ ...order, publicUrl: orderUrl, qrPng }, item);
  const buffer = await buildPdfBuffer((doc) => drawWorkOrder(doc, model));
  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: orderId,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { type: "WORK_ORDER", itemId, folio: order.folio },
  });
  return pdfResponse(buffer, `orden-trabajo-${order.folio}-${item.position}.pdf`);
}

export async function requireItemId(searchParams) {
  const itemId = searchParams.get("itemId");
  if (!itemId) throw new ValidationError("itemId es obligatorio");
  return itemId;
}
