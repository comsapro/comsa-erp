import "server-only";
import { prisma } from "@/lib/db";

function collectRolePermissions(role, permissionSet, rolesMap) {
  if (!role || role.deletedAt || role.status !== "ACTIVE") return;
  if (!rolesMap.has(role.id)) {
    rolesMap.set(role.id, { id: role.id, name: role.name });
  }
  for (const rp of role.permissions || []) {
    if (rp.permission?.code) permissionSet.add(rp.permission.code);
  }
}

// Carga el usuario "vivo" desde la BD junto con sus permisos efectivos
// (union de roles individuales + roles de equipos activos). Devuelve null
// si el usuario no existe, esta eliminado logicamente o esta inactivo.
export async function loadUserAuthContext(userId) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
      mustChangePassword: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              status: true,
              deletedAt: true,
              permissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
        },
      },
      teamMemberships: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
              status: true,
              deletedAt: true,
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                      deletedAt: true,
                      permissions: {
                        select: { permission: { select: { code: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    return null;
  }

  const permissionSet = new Set();
  const rolesMap = new Map();
  const directRoles = [];
  const teamRoles = [];

  for (const ur of user.roles) {
    const role = ur.role;
    if (!role || role.deletedAt || role.status !== "ACTIVE") continue;
    directRoles.push({ id: role.id, name: role.name });
    collectRolePermissions(role, permissionSet, rolesMap);
  }

  for (const membership of user.teamMemberships || []) {
    const team = membership.team;
    if (!team || team.deletedAt || team.status !== "ACTIVE") continue;
    for (const tr of team.roles || []) {
      const role = tr.role;
      if (!role || role.deletedAt || role.status !== "ACTIVE") continue;
      teamRoles.push({
        id: role.id,
        name: role.name,
        teamId: team.id,
        teamName: team.name,
      });
      collectRolePermissions(role, permissionSet, rolesMap);
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    roles: [...rolesMap.values()],
    directRoles,
    teamRoles,
    permissions: [...permissionSet],
  };
}
