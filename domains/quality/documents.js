import "server-only";
import { createHash } from "node:crypto";
import { handleUpload } from "@vercel/blob/client";
import { get, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/permissions/errors";
import {
  MAX_ATTACHMENT_BYTES,
  sanitizeFileName,
} from "@/domains/quotes/attachments";
import {
  PDF_CONTENT_TYPE,
  QUALITY_DOCUMENT_TYPES,
} from "./drawing-constants";
import {
  computeQualityStatus,
  isPdfFile,
} from "./calculations";
import {
  createDocumentSchema,
  createVersionSchema,
  registerQualityUploadSchema,
} from "./drawing-schemas";

export async function assertBlobNotUsedByQuality(pathname) {
  if (!pathname) return;
  const used = await prisma.qualityDocumentVersion.findFirst({
    where: { pathname },
    select: { id: true },
  });
  if (used) {
    throw new ConflictError(
      "Este archivo esta vinculado a una inspeccion de calidad y no puede eliminarse"
    );
  }
}

export async function hashBlobPathname(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result?.stream) {
    throw new ValidationError("No se pudo leer el archivo para calcular el hash");
  }
  const hash = createHash("sha256");
  const chunks = [];
  for await (const chunk of result.stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buf);
    chunks.push(buf);
  }
  return {
    hash: hash.digest("hex"),
    buffer: Buffer.concat(chunks),
  };
}

export async function getBlobBuffer(pathname) {
  const { buffer } = await hashBlobPathname(pathname);
  return buffer;
}

function assertPdf(fileName, contentType) {
  if (!isPdfFile(fileName, contentType)) {
    throw new ValidationError("Solo se pueden inspeccionar archivos PDF");
  }
}

export async function findProductionItemOrThrow(productionItemId) {
  const item = await prisma.productionItem.findFirst({
    where: { id: productionItemId },
    include: {
      productionOrder: {
        include: {
          client: { select: { id: true, commercialName: true, legalName: true } },
          quote: { select: { id: true, folio: true } },
        },
      },
    },
  });
  if (!item) throw new NotFoundError("Partida de produccion no encontrada");
  return item;
}

async function resolveQuotePdf(item, quoteItemAttachmentId) {
  if (item.sourceItemType !== "QUOTE_ITEM" || !item.sourceItemId) {
    throw new ValidationError("Esta partida no proviene de una cotizacion");
  }
  const attachment = await prisma.quoteItemAttachment.findFirst({
    where: {
      id: quoteItemAttachmentId,
      quoteItemId: item.sourceItemId,
      audience: "PRODUCTION",
    },
  });
  if (!attachment) {
    throw new NotFoundError("Plano de cotizacion no encontrado para esta partida");
  }
  assertPdf(attachment.fileName, attachment.contentType);
  return {
    sourceKind: "QUOTE_ATTACHMENT",
    quoteItemAttachmentId: attachment.id,
    productionAttachmentId: null,
    pathname: attachment.pathname,
    originalFilename: attachment.fileName,
    contentType: attachment.contentType,
    quoteId: item.productionOrder.quoteId || null,
  };
}

async function resolveProductionPdf(item, productionAttachmentId) {
  const attachment = await prisma.productionAttachment.findFirst({
    where: {
      id: productionAttachmentId,
      productionOrderId: item.productionOrderId,
      productionItemId: item.id,
    },
  });
  if (!attachment) {
    throw new NotFoundError("Adjunto de produccion no encontrado");
  }
  assertPdf(attachment.fileName, attachment.contentType);
  return {
    sourceKind: "PRODUCTION_ATTACHMENT",
    quoteItemAttachmentId: null,
    productionAttachmentId: attachment.id,
    pathname: attachment.pathname,
    originalFilename: attachment.fileName,
    contentType: attachment.contentType,
    quoteId: item.productionOrder.quoteId || null,
  };
}

async function resolveQualityUpload(item, body) {
  const pathname = String(body.pathname || "").trim();
  if (!pathname || pathname.includes("..")) {
    throw new ValidationError("pathname invalido");
  }
  if (
    !pathname.startsWith(`quality/${item.productionOrderId}/`) &&
    !pathname.startsWith(`quality/${item.id}/`)
  ) {
    throw new ValidationError("El archivo no corresponde a esta partida");
  }
  const fileName =
    body.fileName || sanitizeFileName(pathname.split("/").pop()) || "plano.pdf";
  const contentType = body.contentType || PDF_CONTENT_TYPE;
  assertPdf(fileName, contentType);
  return {
    sourceKind: "QUALITY_UPLOAD",
    quoteItemAttachmentId: null,
    productionAttachmentId: null,
    pathname,
    originalFilename: fileName,
    contentType,
    quoteId: item.productionOrder.quoteId || null,
  };
}

async function createVersionRow(tx, { document, source, actor }) {
  const { hash } = await hashBlobPathname(source.pathname);
  return tx.qualityDocumentVersion.create({
    data: {
      qualityDocumentId: document.id,
      versionNumber: document.currentVersionNumber,
      pathname: source.pathname,
      originalFilename: source.originalFilename,
      contentType: source.contentType,
      fileHash: hash,
      createdBy: actor?.id || null,
    },
  });
}

export async function linkQualityDocument(item, source, actor, documentType) {
  const type = QUALITY_DOCUMENT_TYPES.includes(documentType)
    ? documentType
    : "DRAWING";

  const existingWhere = source.quoteItemAttachmentId
    ? {
        productionItemId: item.id,
        quoteItemAttachmentId: source.quoteItemAttachmentId,
        deletedAt: null,
      }
    : source.productionAttachmentId
      ? {
          productionItemId: item.id,
          productionAttachmentId: source.productionAttachmentId,
          deletedAt: null,
        }
      : null;

  if (existingWhere) {
    const existing = await prisma.qualityDocument.findFirst({
      where: existingWhere,
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (existing) {
      const current =
        existing.versions.find(
          (v) => v.versionNumber === existing.currentVersionNumber
        ) || existing.versions[0];
      return { document: existing, version: current };
    }
  }

  return prisma.$transaction(async (tx) => {
    const document = await tx.qualityDocument.create({
      data: {
        productionOrderId: item.productionOrderId,
        productionItemId: item.id,
        quoteId: source.quoteId,
        sourceKind: source.sourceKind,
        quoteItemAttachmentId: source.quoteItemAttachmentId,
        productionAttachmentId: source.productionAttachmentId,
        documentType: type,
        currentVersionNumber: 1,
        originalFilename: source.originalFilename,
        createdBy: actor?.id || null,
        updatedBy: actor?.id || null,
      },
    });
    const version = await createVersionRow(tx, {
      document: { ...document, currentVersionNumber: 1 },
      source,
      actor,
    });
    return { document, version };
  });
}

export async function resolveSourceForItem(item, body) {
  if (body.quoteItemAttachmentId) {
    return resolveQuotePdf(item, body.quoteItemAttachmentId);
  }
  if (body.productionAttachmentId) {
    return resolveProductionPdf(item, body.productionAttachmentId);
  }
  if (body.pathname) {
    return resolveQualityUpload(item, body);
  }
  throw new ValidationError("Indica un archivo origen");
}

export async function createQualityDocument(request) {
  await requirePermission("quality.create");
  const actor = await getActor(request);
  const body = createDocumentSchema.parse(await request.json());
  const item = await findProductionItemOrThrow(body.productionItemId);
  const source = await resolveSourceForItem(item, body);
  const { document, version } = await linkQualityDocument(
    item,
    source,
    actor,
    body.documentType
  );

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityDocument",
    entityId: document.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      productionItemId: item.id,
      sourceKind: source.sourceKind,
      pathname: source.pathname,
      versionId: version.id,
    },
  });

  return jsonCreated({ document, version });
}

export async function createQualityDocumentVersion(request, documentId) {
  await requirePermission("quality.create");
  const actor = await getActor(request);
  const body = createVersionSchema.parse(await request.json());
  const document = await prisma.qualityDocument.findFirst({
    where: { id: documentId, deletedAt: null },
  });
  if (!document) throw new NotFoundError("Documento de calidad no encontrado");

  const item = await findProductionItemOrThrow(document.productionItemId);
  const source = await resolveSourceForItem(item, body);
  const nextNumber = document.currentVersionNumber + 1;

  const version = await prisma.$transaction(async (tx) => {
    const updated = await tx.qualityDocument.update({
      where: { id: document.id },
      data: {
        currentVersionNumber: nextNumber,
        originalFilename: source.originalFilename,
        sourceKind: source.sourceKind,
        quoteItemAttachmentId: source.quoteItemAttachmentId,
        productionAttachmentId: source.productionAttachmentId,
        updatedBy: actor?.id || null,
      },
    });
    return createVersionRow(tx, {
      document: { ...updated, currentVersionNumber: nextNumber },
      source,
      actor,
    });
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityDocumentVersion",
    entityId: version.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      qualityDocumentId: document.id,
      versionNumber: nextNumber,
      pathname: source.pathname,
    },
  });

  return jsonCreated(version);
}

export async function listItemQualityDocuments(request, productionItemId) {
  await requirePermission("quality.view");
  const item = await findProductionItemOrThrow(productionItemId);

  const quotePdfs = [];
  if (item.sourceItemType === "QUOTE_ITEM" && item.sourceItemId) {
    const rows = await prisma.quoteItemAttachment.findMany({
      where: { quoteItemId: item.sourceItemId, audience: "PRODUCTION" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    for (const row of rows) {
      quotePdfs.push({
        id: row.id,
        fileName: row.fileName,
        pathname: row.pathname,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        isPdf: isPdfFile(row.fileName, row.contentType),
        sourceKind: "QUOTE_ATTACHMENT",
      });
    }
  }

  const documents = await prisma.qualityDocument.findMany({
    where: { productionItemId: item.id, deletedAt: null },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const inspections = await prisma.qualityDrawingInspection.findMany({
    where: { productionItemId: item.id },
    include: {
      qualityDocumentVersion: {
        select: {
          id: true,
          versionNumber: true,
          originalFilename: true,
          qualityDocumentId: true,
        },
      },
      inspectedByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const productionFiles = (
    await prisma.productionAttachment.findMany({
      where: {
        productionOrderId: item.productionOrderId,
        productionItemId: item.id,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
  ).map((row) =>
    attachInspectionLinks(
      {
        id: row.id,
        fileName: row.fileName,
        pathname: row.pathname,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        isPdf: isPdfFile(row.fileName, row.contentType),
        sourceKind: "PRODUCTION_ATTACHMENT",
        productionItemId: row.productionItemId,
      },
      documents,
      inspections
    )
  );

  return jsonOk({
    item: {
      id: item.id,
      position: item.position,
      description: item.description,
      status: item.status,
      productionOrderId: item.productionOrderId,
      productionFolio: item.productionOrder.folio,
      clientName:
        item.productionOrder.client?.commercialName ||
        item.productionOrder.client?.legalName ||
        null,
    },
    candidates: {
      quote: quotePdfs,
      production: productionFiles,
    },
    documents,
    inspections,
    qualityStatus: computeQualityStatus(inspections),
  });
}

function attachInspectionLinks(file, documents, inspections) {
  const doc = (documents || []).find(
    (row) => row.productionAttachmentId === file.id
  );
  const current = doc
    ? (doc.versions || []).find(
        (version) => version.versionNumber === doc.currentVersionNumber
      ) || doc.versions?.[0]
    : null;
  const related = (inspections || []).filter((row) => {
    if (current && row.qualityDocumentVersionId === current.id) return true;
    return (
      Boolean(doc) &&
      row.qualityDocumentVersion?.qualityDocumentId === doc.id
    );
  });
  const open = related.find(
    (row) => row.status === "DRAFT" || row.status === "IN_PROGRESS"
  );
  return {
    ...file,
    openInspectionId: open?.id || null,
    latestInspectionId: related[0]?.id || null,
  };
}

export async function handleQualityDocumentUpload(request) {
  await requirePermission("quality.create");
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const productionItemId = searchParams.get("productionItemId");
  if (!productionItemId) {
    throw new ValidationError("productionItemId requerido");
  }
  const item = await findProductionItemOrThrow(productionItemId);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ValidationError(
      "Almacenamiento Blob no configurado (BLOB_READ_WRITE_TOKEN)"
    );
  }

  const body = await request.json();
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      access: "private",
      maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
      addRandomSuffix: true,
      tokenPayload: JSON.stringify({
        productionItemId: item.id,
        productionOrderId: item.productionOrderId,
        userId: actor.id,
      }),
    }),
    onUploadCompleted: async ({ blob }) => {
      const fileName = blob.pathname?.split("/").pop() || "plano.pdf";
      if (!isPdfFile(fileName, blob.contentType)) {
        try {
          await del(blob.url || blob.pathname, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
        } catch {
          /* ignore */
        }
        throw new ValidationError("Solo se aceptan archivos PDF");
      }
    },
  });

  return Response.json(jsonResponse);
}

async function persistQualityUpload({
  actor,
  item,
  pathname,
  fileName,
  contentType,
  qualityDocumentId = null,
}) {
  const existingVersion = await prisma.qualityDocumentVersion.findFirst({
    where: { pathname },
    include: { qualityDocument: true },
  });
  if (existingVersion) {
    return { document: existingVersion.qualityDocument, version: existingVersion };
  }
  const source = {
    sourceKind: "QUALITY_UPLOAD",
    quoteItemAttachmentId: null,
    productionAttachmentId: null,
    pathname,
    originalFilename: fileName,
    contentType,
    quoteId: item.productionOrder.quoteId || null,
  };

  if (qualityDocumentId) {
    const document = await prisma.qualityDocument.findFirst({
      where: { id: qualityDocumentId, deletedAt: null, productionItemId: item.id },
    });
    if (!document) throw new NotFoundError("Documento de calidad no encontrado");
    const nextNumber = document.currentVersionNumber + 1;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.qualityDocument.update({
        where: { id: document.id },
        data: {
          currentVersionNumber: nextNumber,
          originalFilename: fileName,
          sourceKind: "QUALITY_UPLOAD",
          updatedBy: actor?.id || null,
        },
      });
      const version = await createVersionRow(tx, {
        document: { ...updated, currentVersionNumber: nextNumber },
        source,
        actor,
      });
      return { document: updated, version };
    });
  }

  const { document, version } = await linkQualityDocument(
    item,
    source,
    actor,
    "DRAWING"
  );
  return { document, version };
}

export async function registerQualityUpload(request) {
  await requirePermission("quality.create");
  const actor = await getActor(request);
  const body = registerQualityUploadSchema.parse(await request.json());
  const item = await findProductionItemOrThrow(body.productionItemId);
  const pathname = String(body.pathname || "").trim();
  if (pathname.includes("..")) throw new ValidationError("pathname invalido");
  if (
    !pathname.startsWith(`quality/${item.productionOrderId}/`) &&
    !pathname.startsWith(`quality/${item.id}/`)
  ) {
    throw new ValidationError("El archivo no corresponde a esta partida");
  }
  const fileName =
    body.fileName || sanitizeFileName(pathname.split("/").pop()) || "plano.pdf";
  assertPdf(fileName, body.contentType || PDF_CONTENT_TYPE);

  const result = await persistQualityUpload({
    actor,
    item,
    pathname,
    fileName,
    contentType: body.contentType || PDF_CONTENT_TYPE,
    qualityDocumentId: body.qualityDocumentId || null,
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityDocument",
    entityId: result.document?.id || result.qualityDocumentId || result.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { pathname, fileName, productionItemId: item.id },
  });

  return jsonCreated(result);
}
