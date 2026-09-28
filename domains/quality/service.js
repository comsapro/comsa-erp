import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requirePermission, requireAnyPermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { generateFolio } from "@/lib/folios";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/permissions/errors";
import {
  OPEN_QUALITY_ITEM_STATUSES,
  calcSampleCount,
  pieceLabel,
} from "./constants";
import {
  quantityUpdateSchema,
  samplingConfigSchema,
  startInspectionSchema,
  closeInspectionSchema,
  ncrSchema,
  missingProcessSchema,
  reworkOrderSchema,
  reworkSimpleSchema,
  reworkHourSchema,
  instrumentSchema,
  calibrationSchema,
  alertStatusSchema,
  externalShareSchema,
  releaseFirstPieceSchema,
  evidenceSchema,
} from "./schemas";

function dec(n) {
  return Number(n || 0);
}

async function createAlert({
  audience,
  title,
  body,
  eventType,
  productionOrderId = null,
  entityType = null,
  entityId = null,
  createdBy = null,
}) {
  return prisma.qualityAlert.create({
    data: {
      audience,
      title,
      body,
      eventType,
      productionOrderId,
      entityType,
      entityId,
      createdBy,
    },
  });
}

export async function ensureItemConfig(productionItemId, actorId = null) {
  const item = await prisma.productionItem.findFirst({
    where: { id: productionItemId },
    include: { productionOrder: true, qualityConfig: true },
  });
  if (!item) throw new NotFoundError("Partida no encontrada");
  if (item.qualityConfig) return item.qualityConfig;

  const requiresFirst = false;
  return prisma.qualityItemConfig.create({
    data: {
      productionOrderId: item.productionOrderId,
      productionItemId: item.id,
      requestedQty: item.quantity,
      fabricatedQty: 0,
      inspectedQty: 0,
      releasedQty: 0,
      missingQty: item.quantity,
      requiresFirstPiece: requiresFirst,
      inspectionStatus: requiresFirst ? "FIRST_PIECE_PENDING" : "PENDING",
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

export async function listPendingInbox(request) {
  await requirePermission("quality.view");
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  const configs = await prisma.qualityItemConfig.findMany({
    where: {
      inspectionStatus: { in: OPEN_QUALITY_ITEM_STATUSES },
      ...(q
        ? {
            OR: [
              { productionOrder: { folio: { contains: q, mode: "insensitive" } } },
              {
                productionOrder: {
                  client: { commercialName: { contains: q, mode: "insensitive" } },
                },
              },
              { productionItem: { description: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          client: { select: { id: true, commercialName: true } },
          quote: { select: { id: true, folio: true } },
        },
      },
      productionItem: {
        select: {
          id: true,
          position: true,
          description: true,
          quantity: true,
          commitmentDate: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  // Also surface production items without config yet (pending for quality).
  const configuredItemIds = new Set(configs.map((c) => c.productionItemId));
  const bareItems = await prisma.productionItem.findMany({
    where: {
      id: { notIn: [...configuredItemIds] },
      status: { notIn: ["CANCELLED"] },
      productionOrder: { status: { notIn: ["CANCELLED"] } },
      ...(q
        ? {
            OR: [
              { productionOrder: { folio: { contains: q, mode: "insensitive" } } },
              {
                productionOrder: {
                  client: { commercialName: { contains: q, mode: "insensitive" } },
                },
              },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          client: { select: { id: true, commercialName: true } },
          quote: { select: { id: true, folio: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const rows = [
    ...configs.map((c) => ({
      configId: c.id,
      productionOrderId: c.productionOrderId,
      productionItemId: c.productionItemId,
      folio: c.productionOrder.folio,
      clientName: c.productionOrder.client?.commercialName,
      quoteFolio: c.productionOrder.quote?.folio || null,
      position: c.productionItem.position,
      description: c.productionItem.description,
      requestedQty: dec(c.requestedQty),
      fabricatedQty: dec(c.fabricatedQty),
      inspectedQty: dec(c.inspectedQty),
      releasedQty: dec(c.releasedQty),
      missingQty: dec(c.missingQty),
      commitmentDate: c.productionItem.commitmentDate,
      inspectionStatus: c.inspectionStatus,
      requiresFirstPiece: c.requiresFirstPiece,
      firstPieceReleased: c.firstPieceReleased,
      inspectionMode: c.inspectionMode,
    })),
    ...bareItems.map((item) => ({
      configId: null,
      productionOrderId: item.productionOrderId,
      productionItemId: item.id,
      folio: item.productionOrder.folio,
      clientName: item.productionOrder.client?.commercialName,
      quoteFolio: item.productionOrder.quote?.folio || null,
      position: item.position,
      description: item.description,
      requestedQty: dec(item.quantity),
      fabricatedQty: 0,
      inspectedQty: 0,
      releasedQty: 0,
      missingQty: dec(item.quantity),
      commitmentDate: item.commitmentDate,
      inspectionStatus: "PENDING",
      requiresFirstPiece: false,
      firstPieceReleased: false,
      inspectionMode: "FULL",
    })),
  ];

  return jsonOk({ data: rows });
}

export async function getOrderQuality(request, orderId) {
  await requirePermission("quality.view");
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: {
      client: { select: { id: true, commercialName: true } },
      quote: { select: { id: true, folio: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          qualityConfig: {
            include: {
              pieces: { orderBy: { pieceNumber: "asc" } },
              inspections: {
                orderBy: { createdAt: "desc" },
                take: 20,
                include: {
                  inspector: { select: { id: true, name: true } },
                  measurements: true,
                  specialChecks: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  return jsonOk(order);
}

export async function updateQuantities(request, itemId) {
  await requirePermission("quality.register_qty");
  const actor = await getActor(request);
  const body = await request.json();
  const data = quantityUpdateSchema.parse(body);
  const config = await ensureItemConfig(itemId, actor.id);

  const requested = dec(config.requestedQty);
  const fabricated = data.fabricatedQty;
  const missing = Math.max(0, requested - fabricated);

  const updated = await prisma.qualityItemConfig.update({
    where: { id: config.id },
    data: {
      fabricatedQty: fabricated,
      missingQty: missing,
      notes: data.notes || config.notes,
      inspectionStatus:
        config.requiresFirstPiece && !config.firstPieceReleased
          ? "FIRST_PIECE_PENDING"
          : config.inspectionStatus === "PENDING"
            ? "IN_PROGRESS"
            : config.inspectionStatus,
      updatedBy: actor.id,
    },
  });

  if (missing > 0 && fabricated > 0) {
    await createAlert({
      audience: "PRODUCTION",
      title: "Diferencia de cantidad en Calidad",
      body: `Partida con ${fabricated} fabricadas de ${requested} solicitadas (faltan ${missing}).`,
      eventType: "QTY_SHORTAGE",
      productionOrderId: config.productionOrderId,
      entityType: "QualityItemConfig",
      entityId: config.id,
      createdBy: actor.id,
    });
  }

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityItemConfig",
    entityId: config.id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: config,
    newData: updated,
  });

  return jsonOk(updated);
}

export async function configureSampling(request, itemId) {
  await requirePermission("quality.configure_sampling");
  const actor = await getActor(request);
  const data = samplingConfigSchema.parse(await request.json());
  const config = await ensureItemConfig(itemId, actor.id);
  const fabricated = dec(config.fabricatedQty) || dec(config.requestedQty);
  const sampleCount =
    data.inspectionMode === "SAMPLE"
      ? calcSampleCount(fabricated, data.sampleEveryN)
      : null;

  const updated = await prisma.qualityItemConfig.update({
    where: { id: config.id },
    data: {
      inspectionMode: data.inspectionMode,
      sampleEveryN: data.inspectionMode === "SAMPLE" ? data.sampleEveryN : null,
      sampleCountRequired: sampleCount,
      requiresFirstPiece:
        data.requiresFirstPiece ?? config.requiresFirstPiece,
      inspectionStatus:
        (data.requiresFirstPiece ?? config.requiresFirstPiece) &&
        !config.firstPieceReleased
          ? "FIRST_PIECE_PENDING"
          : config.inspectionStatus,
      samplingConfiguredBy: actor.id,
      samplingConfiguredAt: new Date(),
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityItemConfig",
    entityId: config.id,
    action: AUDIT_ACTIONS.UPDATE,
    newData: updated,
  });

  return jsonOk(updated);
}

export async function ensurePieces(request, itemId) {
  await requireAnyPermission(["quality.inspect", "quality.configure_sampling"]);
  const actor = await getActor(request);
  const body = await request.json().catch(() => ({}));
  const config = await ensureItemConfig(itemId, actor.id);
  const count =
    Number(body.count) ||
    Math.max(
      1,
      Math.ceil(
        dec(config.fabricatedQty) ||
          dec(config.requestedQty) ||
          1
      )
    );

  const existing = await prisma.qualityPiece.count({
    where: { qualityConfigId: config.id },
  });
  if (existing >= count) {
    const pieces = await prisma.qualityPiece.findMany({
      where: { qualityConfigId: config.id },
      orderBy: { pieceNumber: "asc" },
    });
    return jsonOk({ pieces, created: 0 });
  }

  const sampleEvery = config.inspectionMode === "SAMPLE" ? config.sampleEveryN : null;
  const toCreate = [];
  for (let n = existing + 1; n <= count; n += 1) {
    const isSample =
      config.inspectionMode === "SAMPLE" &&
      sampleEvery > 0 &&
      n % sampleEvery === 1;
    toCreate.push({
      productionItemId: itemId,
      qualityConfigId: config.id,
      pieceNumber: n,
      label: pieceLabel(n),
      isFirstPiece: n === 1 && config.requiresFirstPiece,
      isSample: config.inspectionMode === "FULL" ? true : Boolean(isSample),
      status: "PENDING",
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }

  await prisma.qualityPiece.createMany({ data: toCreate });
  const pieces = await prisma.qualityPiece.findMany({
    where: { qualityConfigId: config.id },
    orderBy: { pieceNumber: "asc" },
  });
  return jsonCreated({ pieces, created: toCreate.length });
}

function instrumentIsExpired(instrument, now = new Date()) {
  if (!instrument) return false;
  if (instrument.status === "EXPIRED" || instrument.status === "OUT_OF_SERVICE") {
    return true;
  }
  if (instrument.nextCalibrationAt && instrument.nextCalibrationAt < now) {
    return true;
  }
  return false;
}

export async function startInspection(request, itemId) {
  await requirePermission("quality.inspect");
  const actor = await getActor(request);
  const data = startInspectionSchema.parse(await request.json());
  const config = await ensureItemConfig(itemId, actor.id);

  let instrumentWarned = false;
  if (data.instrumentId) {
    const instrument = await prisma.measuringInstrument.findFirst({
      where: { id: data.instrumentId, deletedAt: null },
    });
    if (!instrument) throw new NotFoundError("Instrumento no encontrado");
    if (instrumentIsExpired(instrument)) {
      if (!data.allowExpiredInstrument) {
        throw new ValidationError(
          "El instrumento tiene calibracion vencida o esta fuera de servicio"
        );
      }
      instrumentWarned = true;
    }
  }

  if (data.type === "FIRST_PIECE" && !config.requiresFirstPiece) {
    throw new ValidationError("Esta partida no requiere liberacion de primera pieza");
  }

  const inspection = await prisma.qualityInspection.create({
    data: {
      qualityConfigId: config.id,
      qualityPieceId: data.qualityPieceId || null,
      type: data.type,
      status: "IN_PROGRESS",
      inspectorId: actor.id,
      startedAt: new Date(),
      instrumentId: data.instrumentId || null,
      instrumentWarned,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
    include: {
      inspector: { select: { id: true, name: true } },
      qualityPiece: true,
    },
  });

  if (data.qualityPieceId) {
    await prisma.qualityPiece.update({
      where: { id: data.qualityPieceId },
      data: { status: "IN_INSPECTION", updatedBy: actor.id },
    });
  }

  await prisma.qualityItemConfig.update({
    where: { id: config.id },
    data: {
      inspectionStatus:
        data.type === "FIRST_PIECE" ? "FIRST_PIECE_PENDING" : "IN_PROGRESS",
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: inspection.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: inspection,
  });

  return jsonCreated(inspection);
}

export async function closeInspection(request, inspectionId) {
  await requirePermission("quality.close_inspection");
  const actor = await getActor(request);
  const data = closeInspectionSchema.parse(await request.json());

  const inspection = await prisma.qualityInspection.findFirst({
    where: { id: inspectionId },
    include: {
      specialChecks: true,
      qualityConfig: true,
      qualityPiece: true,
    },
  });
  if (!inspection) throw new NotFoundError("Inspeccion no encontrada");
  if (inspection.status === "CLOSED") {
    throw new ConflictError("La inspeccion ya esta cerrada");
  }

  const requiredOpen = (inspection.specialChecks || []).filter(
    (c) => c.required && c.result === "PENDING"
  );
  if (requiredOpen.length) {
    throw new ValidationError(
      "Hay inspecciones especiales obligatorias pendientes"
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.qualityMeasurement.deleteMany({
      where: { qualityInspectionId: inspectionId },
    });
    if (data.measurements?.length) {
      await tx.qualityMeasurement.createMany({
        data: data.measurements.map((m, i) => ({
          qualityInspectionId: inspectionId,
          ...m,
          sortOrder: m.sortOrder ?? i,
        })),
      });
    }

    for (const check of data.specialChecks || []) {
      await tx.qualitySpecialCheck.create({
        data: {
          qualityInspectionId: inspectionId,
          ...check,
          completedAt: check.result !== "PENDING" ? new Date() : null,
          completedBy: actor.id,
        },
      });
    }

    const closed = await tx.qualityInspection.update({
      where: { id: inspectionId },
      data: {
        status: "CLOSED",
        result: data.result,
        observations: data.observations || null,
        closedAt: new Date(),
        updatedBy: actor.id,
      },
    });

    if (inspection.qualityPieceId) {
      await tx.qualityPiece.update({
        where: { id: inspection.qualityPieceId },
        data: {
          result: data.result,
          status:
            data.result === "CONFORMING"
              ? inspection.type === "FIRST_PIECE"
                ? "RELEASED"
                : "CONFORMING"
              : "NON_CONFORMING",
          releasedAt:
            data.result === "CONFORMING" && inspection.type === "FIRST_PIECE"
              ? new Date()
              : undefined,
          releasedBy:
            data.result === "CONFORMING" && inspection.type === "FIRST_PIECE"
              ? actor.id
              : undefined,
          updatedBy: actor.id,
        },
      });
    }

    const inspectedQty = dec(inspection.qualityConfig.inspectedQty) + 1;
    const releasedQty =
      data.result === "CONFORMING"
        ? dec(inspection.qualityConfig.releasedQty) + 1
        : dec(inspection.qualityConfig.releasedQty);

    let nextStatus = "IN_PROGRESS";
    if (
      inspection.type === "FIRST_PIECE" &&
      data.result === "CONFORMING"
    ) {
      nextStatus = "IN_PROGRESS";
    }

    await tx.qualityItemConfig.update({
      where: { id: inspection.qualityConfigId },
      data: {
        inspectedQty,
        releasedQty,
        firstPieceReleased:
          inspection.type === "FIRST_PIECE" && data.result === "CONFORMING"
            ? true
            : inspection.qualityConfig.firstPieceReleased,
        firstPieceReleasedAt:
          inspection.type === "FIRST_PIECE" && data.result === "CONFORMING"
            ? new Date()
            : inspection.qualityConfig.firstPieceReleasedAt,
        inspectionStatus: nextStatus,
        updatedBy: actor.id,
      },
    });

    return closed;
  });

  if (data.result === "NON_CONFORMING") {
    await createAlert({
      audience: "PRODUCTION",
      title: "Pieza no conforme",
      body: `Inspeccion ${inspectionId} resulto no conforme.`,
      eventType: "NON_CONFORMING",
      productionOrderId: inspection.qualityConfig.productionOrderId,
      entityType: "QualityInspection",
      entityId: inspectionId,
      createdBy: actor.id,
    });
    await createAlert({
      audience: "SALES",
      title: "Pieza rechazada en Calidad",
      body: `Se registro no conformidad en OP vinculada.`,
      eventType: "NON_CONFORMING",
      productionOrderId: inspection.qualityConfig.productionOrderId,
      entityType: "QualityInspection",
      entityId: inspectionId,
      createdBy: actor.id,
    });
  }

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: inspectionId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: inspection,
    newData: updated,
  });

  return jsonOk(updated);
}

export async function releaseFirstPiece(request, itemId) {
  await requirePermission("quality.release_first_piece");
  const actor = await getActor(request);
  const data = releaseFirstPieceSchema.parse(await request.json());
  const config = await ensureItemConfig(itemId, actor.id);
  const inspection = await prisma.qualityInspection.findFirst({
    where: {
      id: data.qualityInspectionId,
      qualityConfigId: config.id,
      type: "FIRST_PIECE",
      status: "CLOSED",
      result: "CONFORMING",
    },
  });
  if (!inspection) {
    throw new ValidationError(
      "Se requiere una inspeccion de primera pieza cerrada y conforme"
    );
  }

  const updated = await prisma.qualityItemConfig.update({
    where: { id: config.id },
    data: {
      firstPieceReleased: true,
      firstPieceReleasedAt: new Date(),
      inspectionStatus: "IN_PROGRESS",
      notes: data.observations || config.notes,
      updatedBy: actor.id,
    },
  });

  await prisma.qualityPiece.updateMany({
    where: { id: data.qualityPieceId },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      releasedBy: actor.id,
      result: "CONFORMING",
    },
  });

  await createAlert({
    audience: "PRODUCTION",
    title: "Primera pieza liberada",
    body: "Calidad libero la primera pieza; puede continuar el lote.",
    eventType: "FIRST_PIECE_RELEASED",
    productionOrderId: config.productionOrderId,
    entityType: "QualityItemConfig",
    entityId: config.id,
    createdBy: actor.id,
  });

  return jsonOk(updated);
}

export async function recordNcr(request) {
  await requirePermission("quality.record_ncr");
  const actor = await getActor(request);
  const data = ncrSchema.parse(await request.json());
  const inspection = await prisma.qualityInspection.findFirst({
    where: { id: data.qualityInspectionId },
    include: { qualityConfig: true },
  });
  if (!inspection) throw new NotFoundError("Inspeccion no encontrada");

  const ncr = await prisma.qualityNonConformance.create({
    data: {
      qualityInspectionId: data.qualityInspectionId,
      qualityPieceId: data.qualityPieceId || null,
      result: "NON_CONFORMING",
      description: data.description,
      area: data.area || null,
      processName: data.processName || null,
      operatorId: data.operatorId || null,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });

  await createAlert({
    audience: "MANAGEMENT",
    title: "No conformidad registrada",
    body: data.description,
    eventType: "NCR",
    productionOrderId: inspection.qualityConfig.productionOrderId,
    entityType: "QualityNonConformance",
    entityId: ncr.id,
    createdBy: actor.id,
  });

  return jsonCreated(ncr);
}

export async function requestMissingProcess(request) {
  await requirePermission("quality.inspect");
  const actor = await getActor(request);
  const data = missingProcessSchema.parse(await request.json());

  const item = await prisma.productionItem.findFirst({
    where: { id: data.productionItemId },
  });
  if (!item) throw new NotFoundError("Partida no encontrada");

  const maxSort = await prisma.productionItemProcess.aggregate({
    where: { productionItemId: item.id },
    _max: { sortOrder: true },
  });

  const process = await prisma.productionItemProcess.create({
    data: {
      productionItemId: item.id,
      sourceType: "PRODUCTION",
      manufacturingProcessId: data.manufacturingProcessId || null,
      processNameSnapshot: data.processName,
      unitSnapshot: "HOUR",
      quotedHours: 0,
      expectedHours: 0,
      realHours: 0,
      sortOrder: (maxSort._max.sortOrder || 0) + 1,
      notes: data.notes
        ? `Solicitado por Calidad: ${data.notes}`
        : "Solicitado por Calidad",
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });

  const reqRow = await prisma.qualityMissingProcessRequest.create({
    data: {
      qualityInspectionId: data.qualityInspectionId,
      productionOrderId: item.productionOrderId,
      productionItemId: item.id,
      processName: data.processName,
      manufacturingProcessId: data.manufacturingProcessId || null,
      notes: data.notes || null,
      productionProcessId: process.id,
      createdBy: actor.id,
    },
  });

  await createAlert({
    audience: "PRODUCTION",
    title: "Proceso faltante detectado por Calidad",
    body: `Se agrego el proceso "${data.processName}" a la partida.`,
    eventType: "MISSING_PROCESS",
    productionOrderId: item.productionOrderId,
    entityType: "QualityMissingProcessRequest",
    entityId: reqRow.id,
    createdBy: actor.id,
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityMissingProcessRequest",
    entityId: reqRow.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: reqRow,
  });

  return jsonCreated({ request: reqRow, process });
}

export async function createReworkOrder(request) {
  await requirePermission("quality.create_rework");
  const actor = await getActor(request);
  const data = reworkOrderSchema.parse(await request.json());
  const item = await prisma.productionItem.findFirst({
    where: { id: data.productionItemId },
  });
  if (!item) throw new NotFoundError("Partida no encontrada");

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "QUALITY_REWORK");
    const order = await tx.qualityReworkOrder.create({
      data: {
        folio,
        productionOrderId: item.productionOrderId,
        productionItemId: item.id,
        cause: data.cause,
        instructions: data.instructions || null,
        area: data.area || null,
        processName: data.processName || null,
        operatorName: data.operatorName || null,
        materialUsed: data.materialUsed || null,
        expectedEndAt: data.expectedEndAt || null,
        responsibleId: data.responsibleId || null,
        createdById: actor.id,
        pieces: {
          create: data.qualityPieceIds.map((qualityPieceId) => ({
            qualityPieceId,
          })),
        },
      },
      include: { pieces: true },
    });

    await tx.qualityPiece.updateMany({
      where: { id: { in: data.qualityPieceIds } },
      data: { status: "REWORK", updatedBy: actor.id },
    });

    await tx.productionItem.update({
      where: { id: item.id },
      data: { status: "REWORK", updatedBy: actor.id },
    });

    return order;
  });

  await createAlert({
    audience: "PRODUCTION",
    title: `Retrabajo ${record.folio}`,
    body: data.cause,
    eventType: "REWORK_CREATED",
    productionOrderId: item.productionOrderId,
    entityType: "QualityReworkOrder",
    entityId: record.id,
    createdBy: actor.id,
  });

  return jsonCreated(record);
}

export async function createReworkSimple(request) {
  await requirePermission("quality.create_rework");
  const actor = await getActor(request);
  const data = reworkSimpleSchema.parse(await request.json());
  const item = await prisma.productionItem.findFirst({
    where: { id: data.productionItemId },
  });
  if (!item) throw new NotFoundError("Partida no encontrada");

  const row = await prisma.qualityReworkSimple.create({
    data: {
      productionOrderId: item.productionOrderId,
      productionItemId: item.id,
      qualityPieceId: data.qualityPieceId || null,
      area: data.area || null,
      processName: data.processName || null,
      operatorName: data.operatorName || null,
      errorDescription: data.errorDescription,
      hoursUsed: data.hoursUsed,
      createdById: actor.id,
    },
  });

  return jsonCreated(row);
}

export async function addReworkHours(request, reworkOrderId) {
  await requirePermission("quality.record_rework_hours");
  const actor = await getActor(request);
  const data = reworkHourSchema.parse(await request.json());
  const order = await prisma.qualityReworkOrder.findFirst({
    where: { id: reworkOrderId },
  });
  if (!order) throw new NotFoundError("Orden de retrabajo no encontrada");

  const hour = await prisma.qualityReworkHour.create({
    data: {
      reworkOrderId,
      processName: data.processName,
      hours: data.hours,
      notes: data.notes || null,
      createdBy: actor.id,
    },
  });

  const agg = await prisma.qualityReworkHour.aggregate({
    where: { reworkOrderId },
    _sum: { hours: true },
  });

  await prisma.qualityReworkOrder.update({
    where: { id: reworkOrderId },
    data: { totalHours: agg._sum.hours || 0, updatedBy: actor.id },
  });

  return jsonCreated(hour);
}

export async function listInstruments(request) {
  await requireAnyPermission([
    "quality.manage_instruments",
    "quality.inspect",
    "quality.view",
  ]);
  const rows = await prisma.measuringInstrument.findMany({
    where: { deletedAt: null },
    include: {
      calibrations: { orderBy: { calibratedAt: "desc" }, take: 3 },
    },
    orderBy: { code: "asc" },
  });
  return jsonOk({ data: rows });
}

export async function createInstrument(request) {
  await requirePermission("quality.manage_instruments");
  const actor = await getActor(request);
  const data = instrumentSchema.parse(await request.json());
  const row = await prisma.measuringInstrument.create({
    data: {
      ...data,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });
  return jsonCreated(row);
}

export async function updateInstrument(request, id) {
  await requirePermission("quality.manage_instruments");
  const actor = await getActor(request);
  const data = instrumentSchema.partial().parse(await request.json());
  const existing = await prisma.measuringInstrument.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Instrumento no encontrado");
  const row = await prisma.measuringInstrument.update({
    where: { id },
    data: { ...data, updatedBy: actor.id },
  });
  return jsonOk(row);
}

export async function addCalibration(request, instrumentId) {
  await requirePermission("quality.manage_calibrations");
  const actor = await getActor(request);
  const data = calibrationSchema.parse(await request.json());
  const instrument = await prisma.measuringInstrument.findFirst({
    where: { id: instrumentId, deletedAt: null },
  });
  if (!instrument) throw new NotFoundError("Instrumento no encontrado");

  const cal = await prisma.instrumentCalibration.create({
    data: {
      instrumentId,
      ...data,
      createdBy: actor.id,
    },
  });

  let status = "ACTIVE";
  const nextDue = data.nextDueAt || null;
  if (nextDue) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    if (nextDue < new Date()) status = "EXPIRED";
    else if (nextDue <= soon) status = "DUE_SOON";
  }

  await prisma.measuringInstrument.update({
    where: { id: instrumentId },
    data: {
      lastCalibrationAt: data.calibratedAt,
      nextCalibrationAt: nextDue,
      status,
      updatedBy: actor.id,
    },
  });

  return jsonCreated(cal);
}

export async function listAlerts(request) {
  await requirePermission("quality.manage_alerts");
  const url = new URL(request.url);
  const audience = url.searchParams.get("audience");
  const status = url.searchParams.get("status") || "OPEN";
  const rows = await prisma.qualityAlert.findMany({
    where: {
      ...(audience ? { audience } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      productionOrder: { select: { id: true, folio: true } },
    },
  });
  return jsonOk({ data: rows });
}

export async function updateAlert(request, id) {
  await requirePermission("quality.manage_alerts");
  const data = alertStatusSchema.parse(await request.json());
  const existing = await prisma.qualityAlert.findFirst({ where: { id } });
  if (!existing) throw new NotFoundError("Alerta no encontrada");
  const row = await prisma.qualityAlert.update({
    where: { id },
    data: {
      status: data.status,
      acknowledgedAt:
        data.status === "ACKNOWLEDGED" ? new Date() : existing.acknowledgedAt,
      resolvedAt:
        data.status === "RESOLVED" || data.status === "DISMISSED"
          ? new Date()
          : existing.resolvedAt,
    },
  });
  return jsonOk(row);
}

export async function projectHistory(request, productionOrderId) {
  await requirePermission("quality.view_history");
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId },
    include: {
      client: { select: { commercialName: true } },
      quote: { select: { folio: true } },
      items: {
        include: {
          qualityConfig: true,
          qualityPieces: true,
        },
      },
      qualityReworkOrders: { include: { hours: true } },
      qualityReworkSimples: true,
    },
  });
  if (!order) throw new NotFoundError("Orden no encontrada");

  const configs = order.items.map((i) => i.qualityConfig).filter(Boolean);
  const pieces = order.items.flatMap((i) => i.qualityPieces || []);
  const requested = configs.reduce((a, c) => a + dec(c.requestedQty), 0);
  const fabricated = configs.reduce((a, c) => a + dec(c.fabricatedQty), 0);
  const inspected = configs.reduce((a, c) => a + dec(c.inspectedQty), 0);
  const released = configs.reduce((a, c) => a + dec(c.releasedQty), 0);
  const rejected = pieces.filter((p) => p.result === "NON_CONFORMING").length;
  const reworkHours =
    order.qualityReworkOrders.reduce((a, r) => a + dec(r.totalHours), 0) +
    order.qualityReworkSimples.reduce((a, r) => a + dec(r.hoursUsed), 0);

  const causes = {};
  for (const r of order.qualityReworkOrders) {
    causes[r.cause] = (causes[r.cause] || 0) + 1;
  }
  for (const r of order.qualityReworkSimples) {
    causes[r.errorDescription] = (causes[r.errorDescription] || 0) + 1;
  }

  return jsonOk({
    order: {
      id: order.id,
      folio: order.folio,
      clientName: order.client?.commercialName,
      quoteFolio: order.quote?.folio,
    },
    kpis: {
      requested,
      fabricated,
      inspected,
      released,
      rejected,
      reworkOrders: order.qualityReworkOrders.length,
      reworkSimples: order.qualityReworkSimples.length,
      reworkHours,
      rejectRate: inspected > 0 ? rejected / inspected : 0,
      topCauses: Object.entries(causes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cause, count]) => ({ cause, count })),
    },
  });
}

export async function createExternalShare(request) {
  await requirePermission("quality.generate_external_qr");
  const actor = await getActor(request);
  const data = externalShareSchema.parse(await request.json());
  if (!data.qualityPieceId && !data.productionOrderId) {
    throw new ValidationError("Indica pieza u orden");
  }
  const token = randomBytes(24).toString("hex");
  const row = await prisma.qualityExternalShare.create({
    data: {
      token,
      qualityPieceId: data.qualityPieceId || null,
      productionItemId: data.productionItemId || null,
      productionOrderId: data.productionOrderId || null,
      expiresAt: data.expiresAt || null,
      showEvidences: data.showEvidences !== false,
      createdBy: actor.id,
    },
  });
  return jsonCreated({
    ...row,
    path: `/calidad/consulta/${token}`,
  });
}

export async function getExternalShare(token) {
  const share = await prisma.qualityExternalShare.findFirst({
    where: { token, revokedAt: null },
    include: {
      qualityPiece: {
        include: {
          productionItem: {
            select: {
              position: true,
              description: true,
              productionOrder: {
                select: {
                  folio: true,
                  client: { select: { commercialName: true } },
                },
              },
            },
          },
          inspections: {
            where: { status: "CLOSED" },
            orderBy: { closedAt: "desc" },
            take: 5,
            include: {
              measurements: true,
              evidences: true,
            },
          },
          evidences: true,
        },
      },
      productionOrder: {
        select: {
          folio: true,
          client: { select: { commercialName: true } },
        },
      },
    },
  });

  if (!share) throw new NotFoundError("Consulta no disponible");
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new NotFoundError("El enlace expiro");
  }

  const piece = share.qualityPiece;
  return jsonOk({
    project: piece?.productionItem?.productionOrder?.folio || share.productionOrder?.folio,
    clientName:
      piece?.productionItem?.productionOrder?.client?.commercialName ||
      share.productionOrder?.client?.commercialName,
    position: piece?.productionItem?.position,
    description: piece?.productionItem?.description,
    pieceLabel: piece?.label,
    result: piece?.result,
    inspections: (piece?.inspections || []).map((ins) => ({
      closedAt: ins.closedAt,
      result: ins.result,
      measurements: (ins.measurements || []).map((m) => ({
        label: m.label,
        nominal: m.nominal,
        tolerancePlus: m.tolerancePlus,
        toleranceMinus: m.toleranceMinus,
        measuredValue: m.measuredValue,
        unit: m.unit,
        result: m.result,
      })),
      evidences: share.showEvidences
        ? (ins.evidences || []).map((e) => ({
            fileName: e.fileName,
            pathname: e.pathname,
          }))
        : [],
    })),
  });
}

export function qualityOrderQrPath(orderId) {
  return `/calidad/${orderId}`;
}

export async function registerEvidence(request) {
  await requireAnyPermission(request, [
    "quality.inspect",
    "quality.record_ncr",
    "quality.create_rework",
    "quality.special_inspections",
  ]);
  const actor = await getActor(request);
  const body = evidenceSchema.parse(await request.json());

  if (body.pathname.includes("..") || !body.pathname.startsWith("calidad/")) {
    throw new ValidationError("pathname de evidencia invalido");
  }

  const existing = await prisma.qualityEvidence.findFirst({
    where: { pathname: body.pathname },
  });
  if (existing) return jsonOk(existing);

  const record = await prisma.qualityEvidence.create({
    data: {
      productionOrderId: body.productionOrderId || null,
      productionItemId: body.productionItemId || null,
      qualityPieceId: body.qualityPieceId || null,
      qualityInspectionId: body.qualityInspectionId || null,
      specialCheckId: body.specialCheckId || null,
      nonConformanceId: body.nonConformanceId || null,
      reworkOrderId: body.reworkOrderId || null,
      reworkSimpleId: body.reworkSimpleId || null,
      stage: body.stage,
      pathname: body.pathname,
      url: body.url || null,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      createdBy: actor?.id || null,
    },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityEvidence",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    after: { pathname: record.pathname, stage: record.stage },
  });

  return jsonCreated(record);
}
