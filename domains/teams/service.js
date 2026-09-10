import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission, requireAnyPermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ConflictError, ValidationError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import {
  teamCreateSchema,
  teamUpdateSchema,
  teamMembersSchema,
  teamRolesSchema,
} from "./schemas";

const SORTABLE = ["name", "status", "createdAt"];

const TEAM_INCLUDE = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  },
  roles: {
    include: {
      role: { select: { id: true, name: true, status: true } },
    },
  },
  _count: { select: { members: true, roles: true } },
};

function toDTO(team) {
  if (!team) return team;
  return {
    ...team,
    members: (team.members || []).map((m) => m.user),
    roles: (team.roles || []).map((r) => r.role),
    memberIds: (team.members || []).map((m) => m.userId || m.user?.id),
    roleIds: (team.roles || []).map((r) => r.roleId || r.role?.id),
  };
}

async function assertActiveUsers(userIds = []) {
  if (!userIds.length) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (users.length !== userIds.length) {
    throw new ValidationError(
      "Solo se pueden agregar usuarios activos al equipo"
    );
  }
  return users.map((u) => u.id);
}

async function assertActiveRoles(roleIds = []) {
  if (!roleIds.length) return [];
  const roles = await prisma.role.findMany({
    where: {
      id: { in: roleIds },
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (roles.length !== roleIds.length) {
    throw new ValidationError("Solo se pueden asignar roles activos al equipo");
  }
  return roles.map((r) => r.id);
}

async function findTeamOrThrow(id) {
  const team = await prisma.team.findFirst({
    where: { id, deletedAt: null },
    include: TEAM_INCLUDE,
  });
  if (!team) throw new NotFoundError("Equipo no encontrado");
  return team;
}

export async function listTeams(request) {
  await requireAnyPermission(["teams.view", "sales.manage_goals"]);
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
    prisma.team.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: {
        _count: { select: { members: true, roles: true } },
      },
    }),
    prisma.team.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getTeam(request, id) {
  await requirePermission("teams.view");
  const team = await findTeamOrThrow(id);
  return jsonOk(toDTO(team));
}

export async function createTeam(request) {
  await requirePermission("teams.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = teamCreateSchema.parse(body);

  const duplicate = await prisma.team.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, deletedAt: null },
  });
  if (duplicate) throw new ConflictError("Ya existe un equipo con ese nombre");

  const userIds = await assertActiveUsers(data.userIds || []);
  const roleIds = await assertActiveRoles(data.roleIds || []);

  const team = await prisma.team.create({
    data: {
      name: data.name,
      description: data.description || null,
      status: data.status,
      createdBy: actor.id,
      updatedBy: actor.id,
      members: { create: userIds.map((userId) => ({ userId })) },
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
    },
    include: TEAM_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "teams",
    entity: "Team",
    entityId: team.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: toDTO(team),
  });

  return jsonCreated(toDTO(team));
}

export async function updateTeam(request, id) {
  await requirePermission("teams.edit");
  const actor = await getActor(request);
  const existing = await findTeamOrThrow(id);
  const body = await request.json();
  const data = teamUpdateSchema.parse(body);

  if (data.name && data.name !== existing.name) {
    const duplicate = await prisma.team.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        deletedAt: null,
        NOT: { id },
      },
    });
    if (duplicate) throw new ConflictError("Ya existe un equipo con ese nombre");
  }

  const userIds =
    data.userIds !== undefined
      ? await assertActiveUsers(data.userIds || [])
      : null;
  const roleIds =
    data.roleIds !== undefined
      ? await assertActiveRoles(data.roleIds || [])
      : null;

  const team = await prisma.$transaction(async (tx) => {
    if (userIds) {
      await tx.teamMember.deleteMany({ where: { teamId: id } });
      if (userIds.length) {
        await tx.teamMember.createMany({
          data: userIds.map((userId) => ({ teamId: id, userId })),
        });
      }
    }
    if (roleIds) {
      await tx.teamRole.deleteMany({ where: { teamId: id } });
      if (roleIds.length) {
        await tx.teamRole.createMany({
          data: roleIds.map((roleId) => ({ teamId: id, roleId })),
        });
      }
    }
    return tx.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description || null }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        updatedBy: actor.id,
      },
      include: TEAM_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "teams",
    entity: "Team",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: toDTO(existing),
    newData: toDTO(team),
  });

  return jsonOk(toDTO(team));
}

export async function removeTeam(request, id) {
  await requirePermission("teams.delete");
  const actor = await getActor(request);
  const existing = await findTeamOrThrow(id);

  const team = await prisma.team.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
      updatedBy: actor.id,
    },
    include: TEAM_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "teams",
    entity: "Team",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: toDTO(existing),
    newData: toDTO(team),
  });

  return jsonOk(toDTO(team));
}

export async function replaceTeamMembers(request, id) {
  await requirePermission("teams.edit");
  const actor = await getActor(request);
  await findTeamOrThrow(id);
  const body = await request.json();
  const data = teamMembersSchema.parse(body);
  const userIds = await assertActiveUsers(data.userIds || []);

  const team = await prisma.$transaction(async (tx) => {
    await tx.teamMember.deleteMany({ where: { teamId: id } });
    if (userIds.length) {
      await tx.teamMember.createMany({
        data: userIds.map((userId) => ({ teamId: id, userId })),
      });
    }
    return tx.team.update({
      where: { id },
      data: { updatedBy: actor.id },
      include: TEAM_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "teams",
    entity: "Team",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: { members: toDTO(team).members },
  });

  return jsonOk(toDTO(team));
}

export async function replaceTeamRoles(request, id) {
  await requirePermission("teams.edit");
  const actor = await getActor(request);
  await findTeamOrThrow(id);
  const body = await request.json();
  const data = teamRolesSchema.parse(body);
  const roleIds = await assertActiveRoles(data.roleIds || []);

  const team = await prisma.$transaction(async (tx) => {
    await tx.teamRole.deleteMany({ where: { teamId: id } });
    if (roleIds.length) {
      await tx.teamRole.createMany({
        data: roleIds.map((roleId) => ({ teamId: id, roleId })),
      });
    }
    return tx.team.update({
      where: { id },
      data: { updatedBy: actor.id },
      include: TEAM_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "teams",
    entity: "Team",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: { roles: toDTO(team).roles },
  });

  return jsonOk(toDTO(team));
}
