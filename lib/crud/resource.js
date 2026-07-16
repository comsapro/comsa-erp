import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";

// Fabrica de handlers CRUD reutilizable para catalogos con borrado logico,
// estatus, autoria (created_by/updated_by), busqueda, filtros, orden,
// paginacion, validacion Zod y auditoria automatica.
export function createResource(config) {
  const {
    model,
    moduleKey,
    entity,
    search = [],
    sortable = [],
    defaultSort = "createdAt",
    defaultOrder = "desc",
    listSelect,
    listInclude,
    detailInclude,
    createSchema,
    updateSchema,
    hasStatus = true,
    hasSoftDelete = true,
    beforeWrite,
    buildWhereExtra,
  } = config;

  const delegate = () => prisma[model];

  function baseWhere() {
    return hasSoftDelete ? { deletedAt: null } : {};
  }

  async function list(request) {
    await requirePermission(`${moduleKey}.view`);
    const params = parseListParams(request, {
      allowedSort: sortable,
      defaultSort,
      defaultOrder,
    });

    const where = { ...baseWhere() };
    if (hasStatus && (params.status === "ACTIVE" || params.status === "INACTIVE")) {
      where.status = params.status;
    }
    if (params.q && search.length) {
      where.OR = search.map((field) => ({
        [field]: { contains: params.q, mode: "insensitive" },
      }));
    }
    if (buildWhereExtra) {
      Object.assign(where, buildWhereExtra(params) || {});
    }

    const [rows, total] = await Promise.all([
      delegate().findMany({
        where,
        orderBy: { [params.sort]: params.order },
        skip: params.skip,
        take: params.take,
        ...(listSelect ? { select: listSelect } : {}),
        ...(!listSelect && listInclude ? { include: listInclude } : {}),
      }),
      delegate().count({ where }),
    ]);

    return jsonOk(paginated(rows, total, params));
  }

  async function detail(request, id) {
    await requirePermission(`${moduleKey}.view`);
    const record = await delegate().findFirst({
      where: { id, ...baseWhere() },
      ...(detailInclude ? { include: detailInclude } : {}),
    });
    if (!record) throw new NotFoundError();
    return jsonOk(record);
  }

  async function create(request) {
    await requirePermission(`${moduleKey}.create`);
    const actor = await getActor(request);
    const body = await request.json();
    let data = createSchema.parse(body);
    data = { ...data, createdBy: actor.id, updatedBy: actor.id };
    if (beforeWrite) data = await beforeWrite(data, { actor, mode: "create" });

    const record = await delegate().create({
      data,
      ...(detailInclude ? { include: detailInclude } : {}),
    });

    await recordAudit({
      actor,
      module: moduleKey,
      entity,
      entityId: record.id,
      action: AUDIT_ACTIONS.CREATE,
      newData: record,
    });
    return jsonCreated(record);
  }

  async function update(request, id) {
    await requirePermission(`${moduleKey}.edit`);
    const actor = await getActor(request);
    const existing = await delegate().findFirst({ where: { id, ...baseWhere() } });
    if (!existing) throw new NotFoundError();

    const body = await request.json();
    let data = updateSchema.parse(body);
    data = { ...data, updatedBy: actor.id };
    if (beforeWrite) {
      data = await beforeWrite(data, { actor, mode: "update", existing });
    }

    const record = await delegate().update({
      where: { id },
      data,
      ...(detailInclude ? { include: detailInclude } : {}),
    });

    let action = AUDIT_ACTIONS.UPDATE;
    if (hasStatus && data.status && data.status !== existing.status) {
      action =
        data.status === "ACTIVE"
          ? AUDIT_ACTIONS.ACTIVATE
          : AUDIT_ACTIONS.DEACTIVATE;
    }

    await recordAudit({
      actor,
      module: moduleKey,
      entity,
      entityId: id,
      action,
      previousData: existing,
      newData: record,
    });
    return jsonOk(record);
  }

  async function remove(request, id) {
    await requirePermission(`${moduleKey}.delete`);
    const actor = await getActor(request);
    const existing = await delegate().findFirst({ where: { id, ...baseWhere() } });
    if (!existing) throw new NotFoundError();

    if (hasSoftDelete) {
      await delegate().update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
    } else {
      await delegate().delete({ where: { id } });
    }

    await recordAudit({
      actor,
      module: moduleKey,
      entity,
      entityId: id,
      action: AUDIT_ACTIONS.DELETE,
      previousData: existing,
    });
    return jsonOk({ ok: true });
  }

  return { list, detail, create, update, remove };
}
