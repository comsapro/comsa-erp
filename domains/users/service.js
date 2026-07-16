import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ConflictError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { userCreateSchema, userUpdateSchema } from "./schemas";

const SORTABLE = ["name", "email", "status", "lastLoginAt", "createdAt"];

// Seleccion segura: NUNCA incluye passwordHash.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
};

function toDTO(user) {
  if (!user) return user;
  return { ...user, roles: user.roles.map((ur) => ur.role) };
}

export async function listUsers(request) {
  await requirePermission("users.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  const where = { deletedAt: null };
  if (params.status === "ACTIVE" || params.status === "INACTIVE") {
    where.status = params.status;
  }
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      select: USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOk(paginated(rows.map(toDTO), total, params));
}

export async function getUser(request, id) {
  await requirePermission("users.view");
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });
  if (!user) throw new NotFoundError();
  return jsonOk(toDTO(user));
}

async function validRoleIds(roleIds = []) {
  if (!roleIds.length) return [];
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, deletedAt: null },
    select: { id: true },
  });
  return roles.map((r) => r.id);
}

export async function createUser(request) {
  await requirePermission("users.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = userCreateSchema.parse(body);

  const roleIds = await validRoleIds(data.roleIds);
  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      status: data.status,
      mustChangePassword: data.mustChangePassword,
      createdBy: actor.id,
      updatedBy: actor.id,
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
    },
    select: USER_SELECT,
  });

  await recordAudit({
    actor,
    module: "users",
    entity: "User",
    entityId: user.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: toDTO(user),
  });
  return jsonCreated(toDTO(user));
}

export async function updateUser(request, id) {
  await requirePermission("users.edit");
  const actor = await getActor(request);
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });
  if (!existing) throw new NotFoundError();

  const body = await request.json();
  const data = userUpdateSchema.parse(body);

  // No permitir auto-desactivarse.
  if (
    actor.id === id &&
    data.status === "INACTIVE" &&
    existing.status === "ACTIVE"
  ) {
    throw new ConflictError("No puedes desactivar tu propia cuenta.");
  }

  const updateData = { updatedBy: actor.id };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.mustChangePassword !== undefined)
    updateData.mustChangePassword = data.mustChangePassword;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);

  let rolesChanged = false;
  if (data.roleIds !== undefined) {
    const roleIds = await validRoleIds(data.roleIds);
    const currentIds = existing.roles.map((r) => r.role.id).sort();
    const nextIds = [...roleIds].sort();
    rolesChanged = JSON.stringify(currentIds) !== JSON.stringify(nextIds);
    updateData.roles = {
      deleteMany: {},
      create: roleIds.map((roleId) => ({ roleId })),
    };
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });

  let action = AUDIT_ACTIONS.UPDATE;
  if (data.status && data.status !== existing.status) {
    action =
      data.status === "ACTIVE"
        ? AUDIT_ACTIONS.ACTIVATE
        : AUDIT_ACTIONS.DEACTIVATE;
  }

  await recordAudit({
    actor,
    module: "users",
    entity: "User",
    entityId: id,
    action,
    previousData: toDTO(existing),
    newData: toDTO(user),
  });

  // Registrar cambio de permisos/roles por separado.
  if (rolesChanged) {
    await recordAudit({
      actor,
      module: "users",
      entity: "User",
      entityId: id,
      action: AUDIT_ACTIONS.PERMISSIONS_CHANGE,
      previousData: { roles: existing.roles.map((r) => r.role) },
      newData: { roles: user.roles.map((ur) => ur.role) },
    });
  }

  return jsonOk(toDTO(user));
}

export async function removeUser(request, id) {
  await requirePermission("users.delete");
  const actor = await getActor(request);
  if (actor.id === id) {
    throw new ConflictError("No puedes eliminar tu propia cuenta.");
  }
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });
  if (!existing) throw new NotFoundError();

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE", updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "users",
    entity: "User",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: toDTO(existing),
  });
  return jsonOk({ ok: true });
}
