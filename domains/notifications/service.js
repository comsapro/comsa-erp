import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { UnauthorizedError, NotFoundError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";

/**
 * Crea notificaciones internas. `db` puede ser el cliente o una transaccion.
 * Omite destinatarios vacios y al propio autor (no se notifica uno mismo).
 * El envio por correo queda pendiente de configurar (ver docs).
 */
export async function notifyUsers(db, { userIds = [], createdBy = null, skipAuthor = true, ...data }) {
  const recipients = [...new Set(userIds.filter(Boolean))].filter(
    (id) => !(skipAuthor && createdBy && id === createdBy)
  );
  if (!recipients.length) return 0;
  const result = await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: data.type,
      priority: data.priority || "MEDIUM",
      title: data.title,
      body: data.body || null,
      link: data.link || null,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      createdBy,
    })),
  });
  return result.count;
}

async function requireSessionUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function listMyNotifications(request) {
  const user = await requireSessionUser();
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take")) || 30));
  const where = { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) };
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return jsonOk({ data: rows, unread });
}

export async function unreadSummary() {
  const user = await requireSessionUser();
  const [unread, latest] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return jsonOk({ unread, latest });
}

export async function markNotificationRead(request, id) {
  const user = await requireSessionUser();
  const row = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!row) throw new NotFoundError("Notificacion no encontrada");
  const updated = row.readAt
    ? row
    : await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return jsonOk(updated);
}

export async function markAllNotificationsRead() {
  const user = await requireSessionUser();
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return jsonOk({ updated: result.count });
}
