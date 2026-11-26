import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { qualityErrorSchema, qualityErrorUpdateSchema } from "@/domains/kpis/schemas";
import { QUALITY_ERROR_INCLUDE, mapQualityError } from "@/domains/kpis/data";
import { getCatalogMaps, getKpiSettings, getCatalog } from "@/domains/kpis/settings";
import { errorCost, matchCatalogCode } from "@/domains/kpis/calculations";
import {
  dateColumnBounds,
  keyToDate,
  readPeriodParams,
  resolvePeriod,
  timestampDayKey,
} from "@/domains/kpis/periods";

async function assertCatalogCode(type, code, field) {
  if (!code) return null;
  const hit = await prisma.kpiCatalogEntry.findFirst({
    where: { type, code, deletedAt: null },
    select: { code: true },
  });
  if (!hit) throw new ValidationError("Valor de catalogo invalido", { [field]: ["No existe en el catalogo"] });
  return hit.code;
}

function costRows(costs = [], actorId) {
  return costs.map((c) => ({
    category: c.category,
    concept: c.concept,
    hours: c.category === "LABOR" ? c.hours ?? null : null,
    hourlyRate: c.category === "LABOR" ? c.hourlyRate ?? null : null,
    amount: c.amount || 0,
    notes: c.notes || null,
    createdBy: actorId,
  }));
}

async function loadErrorOrThrow(id) {
  const row = await prisma.qualityError.findFirst({
    where: { id, deletedAt: null },
    include: QUALITY_ERROR_INCLUDE,
  });
  if (!row) throw new NotFoundError("Error de calidad no encontrado");
  return row;
}

export async function listQualityErrors(request) {
  await requirePermission("quality.view");
  const url = new URL(request.url);
  const period = resolvePeriod(readPeriodParams(url.searchParams));
  const stage = url.searchParams.get("stage");
  const onlyUnclassified = url.searchParams.get("unclassified") === "1";
  const orderId = url.searchParams.get("productionOrderId");
  const q = (url.searchParams.get("q") || "").trim();

  const [rows, catalogs, settings, causes, areas, operators, processes] = await Promise.all([
    prisma.qualityError.findMany({
      where: {
        deletedAt: null,
        ...(orderId ? { productionOrderId: orderId } : { detectedAt: dateColumnBounds(period) }),
        ...(stage ? { detectionStage: stage } : {}),
        ...(onlyUnclassified ? { OR: [{ causeCode: null }, { areaCode: null }] } : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { description: { contains: q, mode: "insensitive" } },
                    { operatorName: { contains: q, mode: "insensitive" } },
                    { productionOrder: { folio: { contains: q, mode: "insensitive" } } },
                    { productionOrder: { client: { commercialName: { contains: q, mode: "insensitive" } } } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: QUALITY_ERROR_INCLUDE,
      orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    getCatalogMaps(),
    getKpiSettings(),
    getCatalog("ERROR_CAUSE"),
    getCatalog("ERROR_AREA"),
    getCatalog("OPERATOR"),
    // Mano de obra del error = procesos del catalogo con su misma tarifa.
    prisma.manufacturingProcess.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, code: true, name: true, unit: true, defaultRate: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const data = rows.map((r) => {
    const mapped = mapQualityError(r, catalogs);
    return { ...mapped, cost: errorCost(mapped, settings.laborHourRate) };
  });

  return jsonOk({
    period,
    laborHourRate: settings.laborHourRate,
    causes,
    areas,
    operators: operators.map((o) => ({ code: o.code, label: o.label })),
    processes: processes.map((pr) => ({ ...pr, defaultRate: Number(pr.defaultRate) })),
    data,
  });
}

export async function getQualityError(request, id) {
  await requirePermission("quality.view");
  const [row, catalogs, settings] = await Promise.all([
    loadErrorOrThrow(id),
    getCatalogMaps(),
    getKpiSettings(),
  ]);
  const mapped = mapQualityError(row, catalogs);
  return jsonOk({ ...mapped, cost: errorCost(mapped, settings.laborHourRate) });
}

export async function createQualityError(request) {
  await requirePermission("quality.record_errors");
  const actor = await getActor(request);
  const data = qualityErrorSchema.parse(await request.json());

  const order = await prisma.productionOrder.findFirst({
    where: { id: data.productionOrderId },
    select: { id: true, quoteId: true, items: { select: { id: true } } },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  if (data.productionItemId && !order.items.some((i) => i.id === data.productionItemId)) {
    throw new ValidationError("La partida no pertenece a la orden", { productionItemId: ["Partida invalida"] });
  }
  const causeCode = await assertCatalogCode("ERROR_CAUSE", data.causeCode, "causeCode");
  const areaCode = await assertCatalogCode("ERROR_AREA", data.areaCode, "areaCode");

  const record = await prisma.qualityError.create({
    data: {
      productionOrderId: order.id,
      productionItemId: data.productionItemId || null,
      quoteId: order.quoteId || null,
      detectedAt: keyToDate(data.detectedAt),
      detectionStage: data.detectionStage,
      causeCode,
      areaCode,
      operatorUserId: data.operatorUserId || null,
      operatorName: data.operatorName || null,
      description: data.description,
      source: "MANUAL",
      createdBy: actor.id,
      updatedBy: actor.id,
      costs: { create: costRows(data.costs, actor.id) },
    },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityError",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { ...data },
  });

  return jsonCreated({ id: record.id });
}

export async function updateQualityError(request, id) {
  await requirePermission("quality.record_errors");
  const actor = await getActor(request);
  const existing = await loadErrorOrThrow(id);
  const data = qualityErrorUpdateSchema.parse(await request.json());

  if (data.productionItemId) {
    const item = await prisma.productionItem.findFirst({
      where: { id: data.productionItemId, productionOrderId: existing.productionOrderId },
      select: { id: true },
    });
    if (!item) throw new ValidationError("La partida no pertenece a la orden");
  }

  const patch = { updatedBy: actor.id };
  if (data.detectedAt) patch.detectedAt = keyToDate(data.detectedAt);
  if (data.detectionStage) patch.detectionStage = data.detectionStage;
  if (data.causeCode !== undefined) patch.causeCode = await assertCatalogCode("ERROR_CAUSE", data.causeCode, "causeCode");
  if (data.areaCode !== undefined) patch.areaCode = await assertCatalogCode("ERROR_AREA", data.areaCode, "areaCode");
  if (data.operatorUserId !== undefined) patch.operatorUserId = data.operatorUserId || null;
  if (data.operatorName !== undefined) patch.operatorName = data.operatorName || null;
  if (data.description) patch.description = data.description;
  if (data.productionItemId !== undefined) patch.productionItemId = data.productionItemId || null;

  await prisma.$transaction(async (tx) => {
    await tx.qualityError.update({ where: { id }, data: patch });
    if (data.costs) {
      await tx.qualityErrorCost.deleteMany({ where: { errorId: id } });
      if (data.costs.length) {
        await tx.qualityErrorCost.createMany({
          data: costRows(data.costs, actor.id).map((c) => ({ ...c, errorId: id })),
        });
      }
    }
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityError",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: {
      causeCode: existing.causeCode,
      areaCode: existing.areaCode,
      detectionStage: existing.detectionStage,
      costs: existing.costs,
    },
    newData: data,
  });

  return getQualityError(request, id);
}

export async function deleteQualityError(request, id) {
  await requirePermission("quality.record_errors");
  const actor = await getActor(request);
  const existing = await loadErrorOrThrow(id);
  await prisma.qualityError.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });
  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityError",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: { description: existing.description, productionOrderId: existing.productionOrderId },
  });
  return jsonOk({ ok: true });
}

/**
 * Alta automatica de un error a partir de un retrabajo registrado en Calidad
 * (alimentacion desde la operacion normal). Queda "sin clasificar" en causa
 * hasta que Calidad la asigne. Nunca interrumpe el flujo del retrabajo.
 */
export async function recordErrorFromRework({
  kind,
  reworkId,
  productionOrderId,
  productionItemId,
  area,
  operatorName,
  description,
  createdAt,
  actorId,
}) {
  try {
    const [order, areas] = await Promise.all([
      prisma.productionOrder.findFirst({ where: { id: productionOrderId }, select: { quoteId: true } }),
      getCatalog("ERROR_AREA", { includeInactive: true }),
    ]);
    const link = kind === "ORDER" ? { reworkOrderId: reworkId } : { reworkSimpleId: reworkId };
    const exists = await prisma.qualityError.findFirst({ where: link, select: { id: true } });
    if (exists) return exists;
    return await prisma.qualityError.create({
      data: {
        ...link,
        productionOrderId,
        productionItemId: productionItemId || null,
        quoteId: order?.quoteId || null,
        detectedAt: keyToDate(timestampDayKey(createdAt || new Date())),
        detectionStage: "QUALITY",
        areaCode: matchCatalogCode(area, areas),
        areaText: area || null,
        operatorName: operatorName || null,
        description: description || "Retrabajo",
        source: kind === "ORDER" ? "REWORK_ORDER" : "REWORK_SIMPLE",
        createdBy: actorId || null,
        updatedBy: actorId || null,
      },
    });
  } catch (error) {
    console.error("[quality-errors] No se pudo registrar el error del retrabajo:", error);
    return null;
  }
}
