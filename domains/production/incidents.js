import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { createIncidentSchema, updateIncidentSchema } from "./schemas";
import { recordProductionActivity } from "./activity";
import { getDetailInclude } from "./recalc";

async function findOrderOrThrow(id) {
  const order = await prisma.productionOrder.findFirst({
    where: { id },
    include: getDetailInclude(),
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  return order;
}

export async function listIncidents(request, orderId) {
  await requirePermission("production.view");
  await findOrderOrThrow(orderId);
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const rows = await prisma.productionIncident.findMany({
    where: {
      productionOrderId: orderId,
      ...(itemId ? { productionItemId: itemId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reportedByUser: { select: { id: true, name: true } },
      assignedToUser: { select: { id: true, name: true } },
      attachments: true,
    },
  });
  return jsonOk(rows);
}

export async function createIncident(request, orderId) {
  await requirePermission("production.manage_incidents");
  const actor = await getActor(request);
  const order = await findOrderOrThrow(orderId);
  const data = createIncidentSchema.parse(await request.json());

  if (data.productionItemId) {
    const item = (order.items || []).find((i) => i.id === data.productionItemId);
    if (!item) throw new ValidationError("Partida invalida");
  }

  const created = await prisma.$transaction(async (tx) => {
    const incident = await tx.productionIncident.create({
      data: {
        productionOrderId: orderId,
        productionItemId: data.productionItemId || null,
        processId: data.processId || null,
        type: data.type,
        title: data.title,
        description: data.description,
        blocking: Boolean(data.blocking),
        assignedToUserId: data.assignedToUserId || null,
        reportedBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await recordProductionActivity(tx, {
      type: "INCIDENT",
      productionOrderId: orderId,
      productionItemId: data.productionItemId || null,
      processId: data.processId || null,
      incidentId: incident.id,
      body: `${data.blocking ? "Incidencia bloqueante" : "Incidencia"}: ${data.title}`,
      payload: { type: data.type, blocking: data.blocking },
      createdBy: actor.id,
    });
    return incident;
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionIncident",
    entityId: created.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { title: created.title, blocking: created.blocking },
  });

  const record = await findOrderOrThrow(orderId);
  return jsonCreated(record);
}

export async function updateIncident(request, orderId, incidentId) {
  await requirePermission("production.manage_incidents");
  const actor = await getActor(request);
  await findOrderOrThrow(orderId);
  const existing = await prisma.productionIncident.findFirst({
    where: { id: incidentId, productionOrderId: orderId },
  });
  if (!existing) throw new NotFoundError("Incidencia no encontrada");

  const data = updateIncidentSchema.parse(await request.json());
  const patch = { updatedBy: actor.id };
  if (data.status) patch.status = data.status;
  if (data.actionTaken !== undefined) patch.actionTaken = data.actionTaken;
  if (data.blocking !== undefined) patch.blocking = data.blocking;
  if (data.assignedToUserId !== undefined) {
    patch.assignedToUserId = data.assignedToUserId;
  }
  if (data.description !== undefined) patch.description = data.description;
  if (data.status === "RESOLVED") patch.resolvedAt = new Date();
  if (data.status === "CLOSED") patch.closedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.productionIncident.update({
      where: { id: incidentId },
      data: patch,
    });
    await recordProductionActivity(tx, {
      type: "INCIDENT",
      productionOrderId: orderId,
      productionItemId: existing.productionItemId,
      processId: existing.processId,
      incidentId,
      body: `Incidencia actualizada${data.status ? `: ${data.status}` : ""}`,
      payload: { previousStatus: existing.status, ...patch },
      createdBy: actor.id,
    });
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionIncident",
    entityId: incidentId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { status: existing.status },
    newData: patch,
  });

  return jsonOk(await findOrderOrThrow(orderId));
}
