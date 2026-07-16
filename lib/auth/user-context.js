import "server-only";
import { prisma } from "@/lib/db";

// Carga el usuario "vivo" desde la BD junto con sus permisos efectivos
// (union de los permisos de todos sus roles). Devuelve null si el usuario
// no existe, esta eliminado logicamente o esta inactivo (sesion invalida).
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
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    return null;
  }

  const permissionSet = new Set();
  const roles = [];
  for (const ur of user.roles) {
    const role = ur.role;
    if (!role || role.deletedAt || role.status !== "ACTIVE") continue;
    roles.push({ id: role.id, name: role.name });
    for (const rp of role.permissions) {
      permissionSet.add(rp.permission.code);
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    roles,
    permissions: [...permissionSet],
  };
}
