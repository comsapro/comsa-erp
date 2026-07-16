import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk } from "@/lib/api/http";

const SORTABLE = ["createdAt", "module", "action"];

export async function listAuditLogs(request) {
  await requirePermission("audit.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  const where = {};
  const moduleFilter = params.searchParams.get("module");
  const actionFilter = params.searchParams.get("action");
  if (moduleFilter) where.module = moduleFilter;
  if (actionFilter) where.action = actionFilter;
  if (params.q) {
    where.OR = [
      { entity: { contains: params.q, mode: "insensitive" } },
      { entityId: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}
