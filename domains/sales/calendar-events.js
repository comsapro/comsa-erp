import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError } from "@/lib/permissions/errors";
import { getCurrentUser, userIsAdmin } from "@/lib/auth/session";
import { salesCalendarEventSchema } from "./schemas";
import { canViewTeamSales } from "./scope";

const INCLUDE = {
  user: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
};

async function visibleUserIds(user) {
  if (userIsAdmin(user) || canViewTeamSales(user)) return null;
  return [user.id];
}

function assertOwner(event, user) {
  if (userIsAdmin(user)) return;
  if (event.userId !== user.id) {
    throw new ForbiddenError("Solo puedes editar tus propios eventos");
  }
}

export async function listSalesCalendarEvents(request) {
  await requirePermission("sales.view");
  const user = await getCurrentUser();
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const userIds = await visibleUserIds(user);
  const where = {
    deletedAt: null,
    ...(userIds ? { userId: { in: userIds } } : {}),
    ...(from || to
      ? {
          eventDate: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };
  const rows = await prisma.salesCalendarEvent.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ eventDate: "asc" }, { title: "asc" }],
  });
  return jsonOk({ data: rows });
}

export async function createSalesCalendarEvent(request) {
  await requirePermission("sales.view");
  const actor = await getActor(request);
  const data = salesCalendarEventSchema.parse(await request.json());
  const record = await prisma.salesCalendarEvent.create({
    data: {
      title: data.title,
      eventDate: data.eventDate,
      type: data.type,
      notes: data.notes || null,
      userId: actor.id,
      teamId: data.teamId || null,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
    include: INCLUDE,
  });
  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesCalendarEvent",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { title: record.title, type: record.type, eventDate: record.eventDate },
  });
  return jsonCreated(record);
}

async function findEventOrThrow(id) {
  const record = await prisma.salesCalendarEvent.findFirst({
    where: { id, deletedAt: null },
  });
  if (!record) throw new NotFoundError("Evento no encontrado");
  return record;
}

export async function updateSalesCalendarEvent(request, id) {
  await requirePermission("sales.view");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const current = await findEventOrThrow(id);
  assertOwner(current, user);
  const data = salesCalendarEventSchema.parse(await request.json());
  const record = await prisma.salesCalendarEvent.update({
    where: { id },
    data: {
      title: data.title,
      eventDate: data.eventDate,
      type: data.type,
      notes: data.notes || null,
      teamId: data.teamId || null,
      updatedBy: actor.id,
    },
    include: INCLUDE,
  });
  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesCalendarEvent",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: { title: record.title, type: record.type, eventDate: record.eventDate },
  });
  return jsonOk(record);
}

export async function deleteSalesCalendarEvent(request, id) {
  await requirePermission("sales.view");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const current = await findEventOrThrow(id);
  assertOwner(current, user);
  await prisma.salesCalendarEvent.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });
  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesCalendarEvent",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    newData: { title: current.title },
  });
  return jsonOk({ ok: true });
}
