import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { clientCreateSchema, clientUpdateSchema } from "./schemas";

const SORTABLE = ["commercialName", "rfc", "status", "createdAt"];

function contactRows(contacts = []) {
  return contacts.map((c) => ({
    name: c.name,
    position: c.position ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    isPrimary: Boolean(c.isPrimary),
  }));
}

export async function listClients(request) {
  await requirePermission("clients.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "commercialName",
    defaultOrder: "asc",
  });

  const where = { deletedAt: null };
  if (params.status === "ACTIVE" || params.status === "INACTIVE") {
    where.status = params.status;
  }
  if (params.q) {
    where.OR = [
      { commercialName: { contains: params.q, mode: "insensitive" } },
      { legalName: { contains: params.q, mode: "insensitive" } },
      { rfc: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getClient(request, id) {
  await requirePermission("clients.view");
  const record = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: { contacts: { orderBy: { isPrimary: "desc" } } },
  });
  if (!record) throw new NotFoundError();
  return jsonOk(record);
}

export async function createClient(request) {
  await requirePermission("clients.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = clientCreateSchema.parse(body);
  const { contacts, ...base } = data;

  const record = await prisma.client.create({
    data: {
      ...base,
      createdBy: actor.id,
      updatedBy: actor.id,
      contacts: { create: contactRows(contacts) },
    },
    include: { contacts: true },
  });

  await recordAudit({
    actor,
    module: "clients",
    entity: "Client",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });
  return jsonCreated(record);
}

export async function updateClient(request, id) {
  await requirePermission("clients.edit");
  const actor = await getActor(request);
  const existing = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: { contacts: true },
  });
  if (!existing) throw new NotFoundError();

  const body = await request.json();
  const data = clientUpdateSchema.parse(body);
  const { contacts, ...base } = data;

  const ops = [];
  // Estrategia de reemplazo de contactos cuando vienen en el payload.
  if (contacts !== undefined) {
    ops.push(prisma.clientContact.deleteMany({ where: { clientId: id } }));
  }
  ops.push(
    prisma.client.update({
      where: { id },
      data: {
        ...base,
        updatedBy: actor.id,
        ...(contacts !== undefined
          ? { contacts: { create: contactRows(contacts) } }
          : {}),
      },
      include: { contacts: true },
    })
  );

  const result = await prisma.$transaction(ops);
  const record = result[result.length - 1];

  let action = AUDIT_ACTIONS.UPDATE;
  if (base.status && base.status !== existing.status) {
    action =
      base.status === "ACTIVE"
        ? AUDIT_ACTIONS.ACTIVATE
        : AUDIT_ACTIONS.DEACTIVATE;
  }

  await recordAudit({
    actor,
    module: "clients",
    entity: "Client",
    entityId: id,
    action,
    previousData: existing,
    newData: record,
  });
  return jsonOk(record);
}

export async function removeClient(request, id) {
  await requirePermission("clients.delete");
  const actor = await getActor(request);
  const existing = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError();

  await prisma.client.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "clients",
    entity: "Client",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });
  return jsonOk({ ok: true });
}
