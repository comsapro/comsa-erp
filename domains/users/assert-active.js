import "server-only";
import { prisma } from "@/lib/db";
import { ValidationError, NotFoundError } from "@/lib/permissions/errors";

/** Valida que el usuario exista, no esté borrado y esté ACTIVE. */
export async function assertActiveUser(userId, label = "Usuario") {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, status: true },
  });
  if (!user) throw new NotFoundError(`${label} no encontrado`);
  if (user.status !== "ACTIVE") {
    throw new ValidationError(`${label} inactivo: no se puede asignar`);
  }
  return user;
}

export async function assertActiveUsers(userIds = [], label = "Usuario") {
  if (!userIds.length) return [];
  const unique = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (users.length !== unique.length) {
    throw new ValidationError(
      `Solo se pueden asignar ${label.toLowerCase()}s activos`
    );
  }
  return users.map((u) => u.id);
}
