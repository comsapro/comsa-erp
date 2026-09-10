import "server-only";
import { prisma } from "@/lib/db";

/**
 * IDs de usuarios activos que comparten al menos un equipo ACTIVE
 * con `userId` (incluye al propio usuario).
 */
export async function getTeamPeerUserIds(userId) {
  if (!userId) return [];

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { deletedAt: null, status: "ACTIVE" },
    },
    select: { teamId: true },
  });

  const teamIds = memberships.map((m) => m.teamId);
  if (!teamIds.length) return [userId];

  const peers = await prisma.teamMember.findMany({
    where: {
      teamId: { in: teamIds },
      team: { deletedAt: null, status: "ACTIVE" },
      user: { deletedAt: null, status: "ACTIVE" },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const ids = new Set(peers.map((p) => p.userId));
  ids.add(userId);
  return [...ids];
}
