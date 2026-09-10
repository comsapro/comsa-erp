import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { jsonOk } from "@/lib/api/http";

/**
 * Lista usuarios activos para selectores (equipos, asignaciones, etc.).
 * Nunca incluye INACTIVE ni borrados.
 */
export async function listActiveUsersForSelect(request) {
  await requireAnyPermission([
    "teams.view",
    "teams.edit",
    "teams.create",
    "users.view",
  ]);
  const params = parseListParams(request, {
    allowedSort: ["name", "email"],
    defaultSort: "name",
    defaultOrder: "asc",
  });

  const where = { deletedAt: null, status: "ACTIVE" };
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
      select: { id: true, name: true, email: true, status: true },
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}
