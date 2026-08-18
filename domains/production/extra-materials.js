import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { extraMaterialSchema } from "./schemas";
import { recordProductionActivity } from "./activity";
import { getDetailInclude } from "./recalc";

export async function listExtraMaterials(request, orderId) {
  const user = await requirePermission("production.view");
  const canCost = user.permissions?.includes("quotes.view_cost");
  const rows = await prisma.productionExtraMaterial.findMany({
    where: { productionOrderId: orderId },
    orderBy: { occurredAt: "desc" },
    include: {
      createdByUser: { select: { id: true, name: true } },
      catalogItem: { select: { id: true, sku: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  const mapped = rows.map((row) => ({
    ...row,
    unitCost: canCost ? row.unitCost : null,
  }));
  return jsonOk(mapped);
}

export async function createExtraMaterial(request, orderId) {
  const user = await requirePermission("production.record_extra_materials");
  const actor = await getActor(request);
  const order = await prisma.productionOrder.findFirst({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");

  const data = extraMaterialSchema.parse(await request.json());
  const canCost = user.permissions?.includes("quotes.view_cost");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.productionExtraMaterial.create({
      data: {
        productionOrderId: orderId,
        productionItemId: data.productionItemId || null,
        processId: data.processId || null,
        catalogItemId: data.catalogItemId || null,
        supplierId: data.supplierId || null,
        description: data.description,
        quantity: new Prisma.Decimal(data.quantity),
        unit: data.unit || null,
        unitCost:
          canCost && data.unitCost != null
            ? new Prisma.Decimal(data.unitCost)
            : null,
        reason: data.reason,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await recordProductionActivity(tx, {
      type: "MATERIAL",
      productionOrderId: orderId,
      productionItemId: data.productionItemId || null,
      processId: data.processId || null,
      extraMaterialId: row.id,
      body: `Material adicional: ${data.description} (${data.quantity} ${data.unit || ""}) · ${data.reason}`,
      createdBy: actor.id,
    });
    return row;
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionExtraMaterial",
    entityId: created.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { description: created.description, quantity: data.quantity },
  });

  const record = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: getDetailInclude(),
  });
  return jsonCreated(record);
}
