import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { generateFolio } from "@/lib/folios";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/permissions/errors";
import {
  EDITABLE_INSPECTION_STATUSES,
  VALID_INSPECTION_TRANSITIONS,
} from "./drawing-constants";
import {
  calculateMeasurementResult,
  clampNormalized,
  computeQualityStatus,
  isPdfFile,
  nextAnnotationLabel,
  summarizeAnnotations,
} from "./calculations";
import {
  completeInspectionSchema,
  createAnnotationSchema,
  createInspectionSchema,
  moveAnnotationSchema,
  updateAnnotationSchema,
  updateInspectionSchema,
} from "./drawing-schemas";
import {
  findProductionItemOrThrow,
  linkQualityDocument,
  resolveSourceForItem,
} from "./documents";

const USER = { select: { id: true, name: true } };

const INSPECTION_LIST_INCLUDE = {
  productionOrder: {
    select: {
      id: true,
      folio: true,
      client: { select: { id: true, commercialName: true, legalName: true } },
    },
  },
  productionItem: {
    select: { id: true, position: true, description: true, quantity: true },
  },
  qualityDocumentVersion: {
    select: {
      id: true,
      versionNumber: true,
      originalFilename: true,
      pathname: true,
      qualityDocumentId: true,
    },
  },
  inspectedByUser: USER,
  createdByUser: USER,
};

const INSPECTION_DETAIL_INCLUDE = {
  ...INSPECTION_LIST_INCLUDE,
  qualityDocumentVersion: {
    include: {
      qualityDocument: true,
    },
  },
  annotations: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      measurement: true,
      createdByUser: USER,
      updatedByUser: USER,
    },
  },
};

function assertTransition(from, to) {
  const allowed = VALID_INSPECTION_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`No se puede cambiar de ${from} a ${to}`);
  }
}

function assertEditable(inspection) {
  if (!EDITABLE_INSPECTION_STATUSES.includes(inspection.status)) {
    throw new ConflictError(
      "La inspeccion esta cerrada y no admite cambios"
    );
  }
}

function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function shapeInspection(record) {
  const summary = summarizeAnnotations(record.annotations || []);
  return {
    ...record,
    summary,
    qualityStatus: computeQualityStatus([record]),
  };
}

function measurementUnit(payload) {
  if (!payload) return "mm";
  if (payload.unit === "other") {
    return String(payload.unitOther || "other").slice(0, 20);
  }
  return payload.unit;
}

function buildMeasurementData(payload) {
  const calc = calculateMeasurementResult(payload);
  return {
    nominalValue: new Prisma.Decimal(payload.nominalValue),
    measuredValue: new Prisma.Decimal(payload.measuredValue),
    upperTolerance: new Prisma.Decimal(payload.upperTolerance),
    lowerTolerance: new Prisma.Decimal(payload.lowerTolerance),
    unit: measurementUnit(payload),
    result: calc.result,
    comments: payload.comments || null,
  };
}

function annotationStatusFromType(type, measurementResult, requested) {
  if (requested) return requested;
  if (type === "MEASUREMENT") return measurementResult || "OPEN";
  if (type === "OBSERVATION") return "OPEN";
  return "OPEN";
}

async function getInspectionOrThrow(id, include = INSPECTION_DETAIL_INCLUDE) {
  const record = await prisma.qualityDrawingInspection.findFirst({
    where: { id },
    include,
  });
  if (!record) throw new NotFoundError("Inspeccion no encontrada");
  return record;
}

export async function attachQualitySummary(order) {
  const itemIds = (order.items || []).map((item) => item.id);
  if (!itemIds.length) {
    return { ...order, items: order.items || [] };
  }
  const inspections = await prisma.qualityDrawingInspection.findMany({
    where: { productionItemId: { in: itemIds } },
    include: {
      qualityDocumentVersion: {
        select: { id: true, versionNumber: true, originalFilename: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const byItem = new Map();
  for (const row of inspections) {
    if (!byItem.has(row.productionItemId)) byItem.set(row.productionItemId, []);
    byItem.get(row.productionItemId).push(row);
  }
  const items = (order.items || []).map((item) => {
    const list = byItem.get(item.id) || [];
    const latest = list[0] || null;
    return {
      ...item,
      qualityStatus: computeQualityStatus(list),
      latestInspection: latest
        ? {
            id: latest.id,
            inspectionNumber: latest.inspectionNumber,
            status: latest.status,
            drawing: latest.qualityDocumentVersion?.originalFilename || null,
            versionNumber: latest.qualityDocumentVersion?.versionNumber || null,
          }
        : null,
      inspectionCount: list.length,
    };
  });
  return { ...order, items };
}

export async function listQualityItems(request) {
  await requirePermission("quality.view");
  const params = parseListParams(request, {
    allowedSort: ["createdAt", "position"],
    defaultSort: "createdAt",
  });
  const qualityStatus = params.searchParams.get("qualityStatus") || "";
  const where = {
    status: { not: "CANCELLED" },
    productionOrder: { status: { not: "CANCELLED" } },
  };
  if (qualityStatus === "NOT_INSPECTED") {
    where.drawingInspections = { none: {} };
  } else if (qualityStatus === "IN_PROGRESS") {
    where.drawingInspections = {
      some: { status: { in: ["DRAFT", "IN_PROGRESS"] } },
    };
  } else if (qualityStatus === "PASSED") {
    where.drawingInspections = { some: { status: "COMPLETED" } };
  } else if (qualityStatus === "FAILED") {
    where.drawingInspections = { some: { status: "REJECTED" } };
  }
  if (params.q) {
    where.OR = [
      { description: { contains: params.q, mode: "insensitive" } },
      {
        productionOrder: {
          folio: { contains: params.q, mode: "insensitive" },
        },
      },
      {
        productionOrder: {
          client: {
            commercialName: { contains: params.q, mode: "insensitive" },
          },
        },
      },
      {
        productionOrder: {
          client: {
            legalName: { contains: params.q, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.productionItem.findMany({
      where,
      orderBy:
        params.sort === "position"
          ? [{ position: params.order }, { createdAt: "desc" }]
          : [{ createdAt: params.order }, { position: "asc" }],
      skip: params.skip,
      take: params.take,
      include: {
        productionOrder: {
          select: {
            id: true,
            folio: true,
            status: true,
            client: { select: { commercialName: true, legalName: true } },
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            contentType: true,
          },
        },
        drawingInspections: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            qualityDocumentVersion: {
              select: { originalFilename: true, versionNumber: true },
            },
          },
        },
      },
    }),
    prisma.productionItem.count({ where }),
  ]);

  const data = rows.map((item) => {
    const pdfs = (item.attachments || []).filter((file) =>
      isPdfFile(file.fileName, file.contentType)
    );
    const inspections = item.drawingInspections || [];
    const latest = inspections[0] || null;
    return {
      id: item.id,
      position: item.position,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
      productionOrder: item.productionOrder,
      clientName:
        item.productionOrder.client?.commercialName ||
        item.productionOrder.client?.legalName ||
        null,
      pdfCount: pdfs.length,
      drawingNames: pdfs.map((file) => file.fileName),
      qualityStatus: computeQualityStatus(inspections),
      latestInspection: latest
        ? {
            id: latest.id,
            inspectionNumber: latest.inspectionNumber,
            status: latest.status,
          }
        : null,
    };
  });

  return jsonOk(paginated(data, total, params));
}

export async function listInspections(request) {
  await requirePermission("quality.view");
  const params = parseListParams(request, {
    allowedSort: ["createdAt", "inspectionNumber", "status", "completedAt"],
    defaultSort: "createdAt",
  });
  const where = {};
  if (params.status) where.status = params.status;
  const productionOrderId = params.searchParams.get("productionOrderId");
  const productionItemId = params.searchParams.get("productionItemId");
  if (productionOrderId) where.productionOrderId = productionOrderId;
  if (productionItemId) where.productionItemId = productionItemId;
  if (params.q) {
    where.OR = [
      { inspectionNumber: { contains: params.q, mode: "insensitive" } },
      {
        productionOrder: {
          folio: { contains: params.q, mode: "insensitive" },
        },
      },
      {
        productionItem: {
          description: { contains: params.q, mode: "insensitive" },
        },
      },
      {
        qualityDocumentVersion: {
          originalFilename: { contains: params.q, mode: "insensitive" },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.qualityDrawingInspection.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: INSPECTION_LIST_INCLUDE,
    }),
    prisma.qualityDrawingInspection.count({ where }),
  ]);

  return jsonOk(paginated(rows.map(shapeInspection), total, params));
}

export async function getInspection(request, id) {
  await requirePermission("quality.view");
  const record = await getInspectionOrThrow(id);
  return jsonOk(shapeInspection(record));
}

async function resolveVersionForCreate(item, body, actor) {
  if (body.qualityDocumentVersionId) {
    const version = await prisma.qualityDocumentVersion.findFirst({
      where: { id: body.qualityDocumentVersionId },
      include: { qualityDocument: true },
    });
    if (!version || version.qualityDocument.productionItemId !== item.id) {
      throw new NotFoundError("Version de plano no encontrada");
    }
    if (version.qualityDocument.deletedAt) {
      throw new NotFoundError("Documento de calidad no encontrado");
    }
    return version;
  }

  if (body.qualityDocumentId) {
    const document = await prisma.qualityDocument.findFirst({
      where: { id: body.qualityDocumentId, deletedAt: null, productionItemId: item.id },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!document) throw new NotFoundError("Documento de calidad no encontrado");
    const version =
      document.versions.find((v) => v.versionNumber === document.currentVersionNumber) ||
      document.versions[0];
    if (!version) throw new NotFoundError("El documento no tiene versiones");
    return version;
  }

  const source = await resolveSourceForItem(item, body);
  const { version } = await linkQualityDocument(
    item,
    source,
    actor,
    body.documentType
  );
  return version;
}

export async function createInspection(request) {
  await requirePermission("quality.create");
  const actor = await getActor(request);
  const body = createInspectionSchema.parse(await request.json());
  const item = await findProductionItemOrThrow(body.productionItemId);
  const version = await resolveVersionForCreate(item, body, actor);

  const open = await prisma.qualityDrawingInspection.findFirst({
    where: {
      productionItemId: item.id,
      qualityDocumentVersionId: version.id,
      status: { in: ["DRAFT", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    include: INSPECTION_DETAIL_INCLUDE,
  });
  if (open) return jsonOk(shapeInspection(open));

  const record = await prisma.$transaction(async (tx) => {
    const inspectionNumber = await generateFolio(tx, "QUALITY_INSPECTION");
    return tx.qualityDrawingInspection.create({
      data: {
        inspectionNumber,
        productionOrderId: item.productionOrderId,
        productionItemId: item.id,
        qualityDocumentVersionId: version.id,
        status: "DRAFT",
        generalComments: body.generalComments || null,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
      include: INSPECTION_DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      inspectionNumber: record.inspectionNumber,
      productionItemId: item.id,
      qualityDocumentVersionId: version.id,
    },
  });

  return jsonCreated(shapeInspection(record));
}

export async function updateInspection(request, id) {
  await requirePermission("quality.edit");
  const actor = await getActor(request);
  const body = updateInspectionSchema.parse(await request.json());
  const existing = await getInspectionOrThrow(id);
  assertEditable(existing);

  const record = await prisma.qualityDrawingInspection.update({
    where: { id },
    data: {
      generalComments: body.generalComments ?? existing.generalComments,
      updatedBy: actor.id,
    },
    include: INSPECTION_DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { generalComments: existing.generalComments },
    newData: { generalComments: record.generalComments },
  });

  return jsonOk(shapeInspection(record));
}

export async function startInspection(request, id) {
  await requirePermission("quality.edit");
  const actor = await getActor(request);
  const existing = await getInspectionOrThrow(id);
  if (existing.status === "IN_PROGRESS") {
    return jsonOk(shapeInspection(existing));
  }
  assertTransition(existing.status, "IN_PROGRESS");

  const record = await prisma.qualityDrawingInspection.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      startedAt: existing.startedAt || new Date(),
      inspectedBy: existing.inspectedBy || actor.id,
      updatedBy: actor.id,
    },
    include: INSPECTION_DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: id,
    action: AUDIT_ACTIONS.START,
    previousData: { status: existing.status },
    newData: { status: "IN_PROGRESS" },
  });

  return jsonOk(shapeInspection(record));
}

export async function completeInspection(request, id) {
  await requirePermission("quality.complete");
  const actor = await getActor(request);
  const body = completeInspectionSchema.parse(await request.json());
  const existing = await getInspectionOrThrow(id);
  const nextStatus = body.result === "REJECTED" ? "REJECTED" : "COMPLETED";

  if (existing.status === "DRAFT") {
    assertTransition("DRAFT", "IN_PROGRESS");
  }
  if (existing.status === "DRAFT" || existing.status === "IN_PROGRESS") {
    if (existing.status === "IN_PROGRESS") {
      assertTransition("IN_PROGRESS", nextStatus);
    }
  } else {
    throw new ConflictError("La inspeccion ya esta cerrada");
  }

  const record = await prisma.qualityDrawingInspection.update({
    where: { id },
    data: {
      status: nextStatus,
      generalComments: body.generalComments ?? existing.generalComments,
      inspectedBy: existing.inspectedBy || actor.id,
      startedAt: existing.startedAt || new Date(),
      completedAt: new Date(),
      updatedBy: actor.id,
    },
    include: INSPECTION_DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: id,
    action: nextStatus === "REJECTED" ? AUDIT_ACTIONS.REJECT : AUDIT_ACTIONS.COMPLETE,
    previousData: { status: existing.status },
    newData: {
      status: nextStatus,
      summary: summarizeAnnotations(record.annotations),
    },
  });

  return jsonOk(shapeInspection(record));
}

async function ensureInProgress(inspection, actor) {
  if (inspection.status === "IN_PROGRESS") return inspection;
  assertEditable(inspection);
  if (inspection.status === "DRAFT") {
    return prisma.qualityDrawingInspection.update({
      where: { id: inspection.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: inspection.startedAt || new Date(),
        inspectedBy: inspection.inspectedBy || actor.id,
        updatedBy: actor.id,
      },
    });
  }
  return inspection;
}

export async function createAnnotation(request, inspectionId) {
  await requirePermission("quality.annotate");
  const actor = await getActor(request);
  const body = createAnnotationSchema.parse(await request.json());
  let inspection = await getInspectionOrThrow(inspectionId);
  assertEditable(inspection);
  inspection = await ensureInProgress(inspection, actor);

  clampNormalized(body.xPosition, "xPosition");
  clampNormalized(body.yPosition, "yPosition");

  const existingLabels = await prisma.qualityAnnotation.findMany({
    where: {
      inspectionId,
      qualityDocumentVersionId: inspection.qualityDocumentVersionId,
    },
    select: { label: true },
  });
  const label = nextAnnotationLabel(existingLabels.map((row) => row.label));

  let measurementData = null;
  if (body.annotationType === "MEASUREMENT") {
    measurementData = buildMeasurementData(body.measurement);
  }

  const status = annotationStatusFromType(
    body.annotationType,
    measurementData?.result,
    body.status
  );

  const record = await prisma.qualityAnnotation.create({
    data: {
      inspectionId,
      qualityDocumentVersionId: inspection.qualityDocumentVersionId,
      pageNumber: body.pageNumber,
      label,
      xPosition: new Prisma.Decimal(body.xPosition),
      yPosition: new Prisma.Decimal(body.yPosition),
      annotationType: body.annotationType,
      title: body.title || null,
      comment: body.comment || null,
      status,
      createdBy: actor.id,
      updatedBy: actor.id,
      measurement: measurementData ? { create: measurementData } : undefined,
    },
    include: { measurement: true, createdByUser: USER, updatedByUser: USER },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityAnnotation",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      inspectionId,
      label,
      annotationType: body.annotationType,
      pageNumber: body.pageNumber,
      result: measurementData?.result || null,
    },
  });

  return jsonCreated(record);
}

export async function updateAnnotation(request, inspectionId, annotationId) {
  await requirePermission("quality.edit_annotation");
  const actor = await getActor(request);
  const body = updateAnnotationSchema.parse(await request.json());
  const inspection = await getInspectionOrThrow(inspectionId);
  assertEditable(inspection);

  const existing = await prisma.qualityAnnotation.findFirst({
    where: { id: annotationId, inspectionId, deletedAt: null },
    include: { measurement: true },
  });
  if (!existing) throw new NotFoundError("Inciso no encontrado");

  const nextType = body.annotationType || existing.annotationType;
  let measurementUpdate = undefined;
  let measurementResult = existing.measurement?.result || null;

  if (nextType === "MEASUREMENT") {
    const payload = body.measurement;
    if (!payload && !existing.measurement) {
      throw new ValidationError("Los datos de medicion son obligatorios");
    }
    if (payload) {
      const data = buildMeasurementData(payload);
      measurementResult = data.result;
      measurementUpdate = existing.measurement
        ? { update: data }
        : { create: data };
    }
  } else if (existing.measurement) {
    measurementUpdate = { delete: true };
    measurementResult = null;
  }

  const status = annotationStatusFromType(
    nextType,
    measurementResult,
    body.status
  );

  const record = await prisma.qualityAnnotation.update({
    where: { id: annotationId },
    data: {
      annotationType: nextType,
      title: body.title !== undefined ? body.title : existing.title,
      comment: body.comment !== undefined ? body.comment : existing.comment,
      status,
      updatedBy: actor.id,
      measurement: measurementUpdate,
    },
    include: { measurement: true, createdByUser: USER, updatedByUser: USER },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityAnnotation",
    entityId: annotationId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: toJsonSafe({
      title: existing.title,
      comment: existing.comment,
      status: existing.status,
      annotationType: existing.annotationType,
      measurement: existing.measurement,
    }),
    newData: toJsonSafe({
      title: record.title,
      comment: record.comment,
      status: record.status,
      annotationType: record.annotationType,
      measurement: record.measurement,
    }),
  });

  return jsonOk(record);
}

export async function moveAnnotation(request, inspectionId, annotationId) {
  await requirePermission("quality.move_annotation");
  const actor = await getActor(request);
  const body = moveAnnotationSchema.parse(await request.json());
  const inspection = await getInspectionOrThrow(inspectionId);
  assertEditable(inspection);

  const existing = await prisma.qualityAnnotation.findFirst({
    where: { id: annotationId, inspectionId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Inciso no encontrado");

  const x = clampNormalized(body.xPosition, "xPosition");
  const y = clampNormalized(body.yPosition, "yPosition");
  const pageNumber = body.pageNumber || existing.pageNumber;

  const record = await prisma.qualityAnnotation.update({
    where: { id: annotationId },
    data: {
      xPosition: new Prisma.Decimal(x),
      yPosition: new Prisma.Decimal(y),
      pageNumber,
      updatedBy: actor.id,
    },
    include: { measurement: true, createdByUser: USER, updatedByUser: USER },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityAnnotation",
    entityId: annotationId,
    action: AUDIT_ACTIONS.MOVE,
    previousData: {
      xPosition: existing.xPosition,
      yPosition: existing.yPosition,
      pageNumber: existing.pageNumber,
    },
    newData: { xPosition: x, yPosition: y, pageNumber },
  });

  return jsonOk(record);
}

export async function deleteAnnotation(request, inspectionId, annotationId) {
  await requirePermission("quality.delete_annotation");
  const actor = await getActor(request);
  const inspection = await getInspectionOrThrow(inspectionId);
  assertEditable(inspection);

  const existing = await prisma.qualityAnnotation.findFirst({
    where: { id: annotationId, inspectionId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Inciso no encontrado");

  await prisma.qualityAnnotation.update({
    where: { id: annotationId },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityAnnotation",
    entityId: annotationId,
    action: AUDIT_ACTIONS.DELETE,
    previousData: {
      label: existing.label,
      annotationType: existing.annotationType,
      pageNumber: existing.pageNumber,
    },
  });

  return jsonOk({ ok: true });
}

export async function listAnnotations(request, inspectionId) {
  await requirePermission("quality.view");
  await getInspectionOrThrow(inspectionId, { productionItem: true });
  const rows = await prisma.qualityAnnotation.findMany({
    where: { inspectionId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { measurement: true, createdByUser: USER, updatedByUser: USER },
  });
  return jsonOk(rows);
}
