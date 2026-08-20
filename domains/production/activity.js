import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { NotFoundError } from "@/lib/permissions/errors";
import { productionNoteSchema } from "./schemas";
import { PRODUCTION_ACTIVITY_FILTERS } from "./constants";
import { getDetailInclude } from "./recalc";

const USER_SELECT = { id: true, name: true };

export async function recordProductionActivity(tx, data) {
  if (!tx?.productionActivity || !data?.productionOrderId || !data?.type) {
    return null;
  }
  return tx.productionActivity.create({
    data: {
      productionOrderId: data.productionOrderId,
      productionItemId: data.productionItemId || null,
      processId: data.processId || null,
      incidentId: data.incidentId || null,
      extraMaterialId: data.extraMaterialId || null,
      type: data.type,
      body: data.body || null,
      payload: data.payload || undefined,
      createdBy: data.createdBy || null,
    },
  });
}

export async function listItemActivity(
  tx,
  { orderId, itemId = null, typeIn = null }
) {
  const where = { productionOrderId: orderId };
  if (itemId) where.productionItemId = itemId;
  if (typeIn?.length) where.type = { in: typeIn };

  return tx.productionActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdByUser: { select: USER_SELECT },
      attachments: {
        select: {
          id: true,
          fileName: true,
          pathname: true,
          contentType: true,
          sizeBytes: true,
          kind: true,
        },
      },
    },
  });
}

export async function getProductionActivity(request, orderId) {
  await requirePermission("production.view");
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const filter = url.searchParams.get("filter");
  const typeIn = PRODUCTION_ACTIVITY_FILTERS[filter] || null;
  const rows = await listItemActivity(prisma, {
    orderId,
    itemId,
    typeIn,
  });
  return jsonOk(rows);
}

export async function addProductionComment(request, orderId) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await prisma.productionOrder.findFirst({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  const body = await request.json();
  const data = productionNoteSchema.parse(body);
  const itemId = body.productionItemId || body.itemId || null;
  const processId = body.processId || null;

  if (itemId) {
    await prisma.productionItemNote.create({
      data: {
        productionItemId: itemId,
        body: data.body,
        createdBy: actor.id,
      },
    });
  }

  await recordProductionActivity(prisma, {
    type: "NOTE",
    productionOrderId: orderId,
    productionItemId: itemId,
    processId,
    body: data.body,
    createdBy: actor.id,
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonCreated(record);
}