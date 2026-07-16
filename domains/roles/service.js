import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import {
  requirePermission,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ConflictError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { roleCreateSchema, roleUpdateSchema } from "./schemas";

const SORTABLE = ["name", "status", "createdAt"];

function toDTO(role) {
  if (!role) return role;
  return {
    ...role,
    permissions: role.permissions?.map((rp) => rp.permission) || [],
    permissionCodes: role.permissions?.map((rp) => rp.permission.code) || [],
  };
}

async function permissionIdsByCodes(codes = []) {
  if (!codes.length) return [];
  const perms = await prisma.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  return perms.map((p) => p.id);
}

export async function listRoles(request) {
  // Referencia usada tambien por el formulario de usuarios.
  await requireAnyPermission(["roles.view", "users.view"]);
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "name",
    defaultOrder: "asc",
  });

  const where = { deletedAt: null };
  if (params.status === "ACTIVE" || params.status === "INACTIVE") {
    where.status = params.status;
  }
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: {
        _count: { select: { permissions: true, users: true } },
      },
    }),
    prisma.role.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getRole(request, id) {
  await requirePermission("roles.view");
  const role = await prisma.role.findFirst({
    where: { id, deletedAt: null },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new NotFoundError();
  return jsonOk(toDTO(role));
}

export async function createRole(request) {
  await requirePermission("roles.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = roleCreateSchema.parse(body);

  const permissionIds = await permissionIdsByCodes(data.permissionCodes);

  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
    },
    include: { permissions: { include: { permission: true } } },
  });

  await recordAudit({
    actor,
    module: "roles",
    entity: "Role",
    entityId: role.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: toDTO(role),
  });
  return jsonCreated(toDTO(role));
}

export async function updateRole(request, id) {
  await requirePermission("roles.edit");
  const actor = await getActor(request);
  const existing = await prisma.role.findFirst({
    where: { id, deletedAt: null },
    include: { permissions: { include: { permission: true } } },
  });
  if (!existing) throw new NotFoundError();

  const body = await request.json();
  const data = roleUpdateSchema.parse(body);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;

  let permissionsChanged = false;
  if (data.permissionCodes !== undefined) {
    const permissionIds = await permissionIdsByCodes(data.permissionCodes);
    const currentCodes = existing.permissions.map((p) => p.permission.code).sort();
    const nextCodes = [...data.permissionCodes].sort();
    permissionsChanged =
      JSON.stringify(currentCodes) !== JSON.stringify(nextCodes);
    updateData.permissions = {
      deleteMany: {},
      create: permissionIds.map((permissionId) => ({ permissionId })),
    };
  }

  const role = await prisma.role.update({
    where: { id },
    data: updateData,
    include: { permissions: { include: { permission: true } } },
  });

  await recordAudit({
    actor,
    module: "roles",
    entity: "Role",
    entityId: id,
    action: permissionsChanged
      ? AUDIT_ACTIONS.PERMISSIONS_CHANGE
      : AUDIT_ACTIONS.UPDATE,
    previousData: toDTO(existing),
    newData: toDTO(role),
  });
  return jsonOk(toDTO(role));
}

export async function removeRole(request, id) {
  await requirePermission("roles.delete");
  const actor = await getActor(request);
  const existing = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError();
  if (existing.isSystem) {
    throw new ConflictError("No se puede eliminar un rol del sistema.");
  }

  await prisma.role.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    actor,
    module: "roles",
    entity: "Role",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });
  return jsonOk({ ok: true });
}
