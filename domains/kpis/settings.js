import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requirePermission, requireAnyPermission } from "@/lib/permissions/require-permission";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { ConflictError, NotFoundError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { catalogEntrySchema, catalogEntryUpdateSchema, kpiSettingsSchema } from "./schemas";
import { KPI_CATALOG_TYPES, catalogManagePermissions } from "./constants";
import { num } from "./calculations";

/** Parametros globales (crea el registro "default" si no existe). */
export async function getKpiSettings() {
  const row = await prisma.kpiSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return {
    taxRate: num(row.taxRate),
    laborHourRate: num(row.laborHourRate),
    defaultCreditDays: row.defaultCreditDays,
    upcomingDays: row.upcomingDays,
    dueSoonDays: row.dueSoonDays,
    updatedAt: row.updatedAt,
  };
}

export async function getKpiSettingsHandler() {
  await requireAnyPermission(["kpis.view", "kpis.manage_catalogs", "quality.view", "sales.view"]);
  return jsonOk(await getKpiSettings());
}

export async function updateKpiSettings(request) {
  await requirePermission("kpis.manage_catalogs");
  const actor = await getActor(request);
  const data = kpiSettingsSchema.parse(await request.json());
  const previous = await getKpiSettings();
  await prisma.kpiSetting.upsert({
    where: { id: "default" },
    update: { ...data, updatedBy: actor.id },
    create: { id: "default", ...data, updatedBy: actor.id },
  });
  await recordAudit({
    actor,
    module: "kpis",
    entity: "KpiSetting",
    entityId: "default",
    action: AUDIT_ACTIONS.UPDATE,
    previousData: previous,
    newData: data,
  });
  return jsonOk(await getKpiSettings());
}

/** Entradas activas de un catalogo (o todas si includeInactive). */
export async function getCatalog(type, { includeInactive = false } = {}) {
  return prisma.kpiCatalogEntry.findMany({
    where: {
      type,
      deletedAt: null,
      ...(includeInactive ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

/** Mapas codigo -> etiqueta de los tres catalogos (incluye inactivos para historicos). */
export async function getCatalogMaps() {
  const rows = await prisma.kpiCatalogEntry.findMany({ where: { deletedAt: null } });
  const maps = Object.fromEntries(Object.values(KPI_CATALOG_TYPES).map((t) => [t, {}]));
  for (const r of rows) {
    if (maps[r.type]) maps[r.type][r.code] = r;
  }
  return maps;
}

export async function listCatalogEntries(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const includeInactive = url.searchParams.get("all") === "1";
  if (includeInactive) {
    await requireAnyPermission(type ? catalogManagePermissions(type) : ["kpis.manage_catalogs"]);
  } else {
    await requireAnyPermission([
      "kpis.view",
      "kpis.manage_incidents",
      "kpis.manage_catalogs",
      "quality.view",
      "quality.manage_instruments",
      "production.manage_incidents",
      "sales.create_invoice",
    ]);
  }
  const types = type && KPI_CATALOG_TYPES[type] ? [type] : Object.values(KPI_CATALOG_TYPES);
  const rows = await prisma.kpiCatalogEntry.findMany({
    where: {
      type: { in: types },
      deletedAt: null,
      ...(includeInactive ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  return jsonOk({ data: rows });
}

export async function createCatalogEntry(request) {
  const data = catalogEntrySchema.parse(await request.json());
  await requireAnyPermission(catalogManagePermissions(data.type));
  const actor = await getActor(request);
  const existing = await prisma.kpiCatalogEntry.findFirst({
    where: { type: data.type, code: data.code },
  });
  if (existing && !existing.deletedAt) {
    throw new ConflictError("Ya existe una entrada con ese codigo en el catalogo");
  }
  const record = existing
    ? await prisma.kpiCatalogEntry.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null, updatedBy: actor.id },
      })
    : await prisma.kpiCatalogEntry.create({
        data: { ...data, createdBy: actor.id, updatedBy: actor.id },
      });
  await recordAudit({
    actor,
    module: "kpis",
    entity: "KpiCatalogEntry",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });
  return jsonCreated(record);
}

export async function updateCatalogEntry(request, id) {
  const existing = await prisma.kpiCatalogEntry.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Entrada de catalogo no encontrada");
  await requireAnyPermission(catalogManagePermissions(existing.type));
  const actor = await getActor(request);
  const data = catalogEntryUpdateSchema.parse(await request.json());
  const record = await prisma.kpiCatalogEntry.update({
    where: { id },
    data: { ...data, updatedBy: actor.id },
  });
  await recordAudit({
    actor,
    module: "kpis",
    entity: "KpiCatalogEntry",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });
  return jsonOk(record);
}

/** Borrado logico: los historicos conservan el codigo. */
export async function deleteCatalogEntry(request, id) {
  const existing = await prisma.kpiCatalogEntry.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Entrada de catalogo no encontrada");
  await requireAnyPermission(catalogManagePermissions(existing.type));
  const actor = await getActor(request);
  await prisma.kpiCatalogEntry.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE", updatedBy: actor.id },
  });
  await recordAudit({
    actor,
    module: "kpis",
    entity: "KpiCatalogEntry",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });
  return jsonOk({ ok: true });
}
