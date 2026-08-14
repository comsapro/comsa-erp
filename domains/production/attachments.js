import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import {
  MAX_ATTACHMENT_BYTES,
  sanitizeFileName,
  isAllowedAttachment,
} from "@/domains/quotes/attachments";

async function findProductionOrThrow(id) {
  const order = await prisma.productionOrder.findFirst({ where: { id } });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");
  return order;
}

function assertOrderAllowsUploads(order) {
  if (order.status === "CANCELLED") {
    throw new ConflictError(
      "No se pueden adjuntar archivos a una orden cancelada"
    );
  }
}

async function persistAttachment({
  actor,
  productionOrderId,
  pathname,
  url,
  fileName,
  contentType,
  sizeBytes,
  kind = "SCAN",
}) {
  const existing = await prisma.productionAttachment.findFirst({
    where: { pathname },
  });
  if (existing) return existing;

  const count = await prisma.productionAttachment.count({
    where: { productionOrderId },
  });

  const record = await prisma.productionAttachment.create({
    data: {
      productionOrderId,
      pathname,
      url: url || null,
      fileName: fileName || pathname.split("/").pop() || "archivo",
      contentType: contentType || "application/octet-stream",
      sizeBytes: Number(sizeBytes) || 0,
      kind: kind === "OTHER" ? "OTHER" : "SCAN",
      sortOrder: count,
      createdBy: actor?.id || null,
      updatedBy: actor?.id || null,
    },
  });

  if (actor) {
    await recordAudit({
      actor,
      module: "production",
      entity: "ProductionAttachment",
      entityId: record.id,
      action: AUDIT_ACTIONS.CREATE,
      newData: {
        productionOrderId,
        fileName: record.fileName,
        pathname: record.pathname,
        kind: record.kind,
        sizeBytes: record.sizeBytes,
      },
    });
  }

  return record;
}

export async function listProductionAttachments(request, productionOrderId) {
  await requirePermission("production.view");
  await findProductionOrThrow(productionOrderId);
  const rows = await prisma.productionAttachment.findMany({
    where: { productionOrderId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return jsonOk(rows);
}

export async function handleProductionAttachmentUpload(
  request,
  productionOrderId
) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(productionOrderId);
  assertOrderAllowsUploads(order);

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
        productionOrderId,
        userId: actor.id,
      }),
    }),
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      try {
        const payload = JSON.parse(tokenPayload || "{}");
        const fileName = blob.pathname?.split("/").pop() || "archivo";
        if (!isAllowedAttachment(fileName, blob.contentType)) {
          try {
            await del(blob.url || blob.pathname, {
              token: process.env.BLOB_READ_WRITE_TOKEN,
            });
          } catch {
            /* ignore cleanup */
          }
          throw new ValidationError(
            "Tipo no permitido. Usa imagenes, PDF o archivos CAD"
          );
        }
        await persistAttachment({
          actor: payload.userId ? { id: payload.userId } : actor,
          productionOrderId: payload.productionOrderId || productionOrderId,
          pathname: blob.pathname,
          url: blob.url,
          fileName,
          contentType: blob.contentType,
          sizeBytes: blob.size,
        });
      } catch (err) {
        console.error("[blob] production onUploadCompleted failed", err);
        throw err;
      }
    },
  });

  return Response.json(jsonResponse);
}

export async function registerProductionAttachment(request, productionOrderId) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(productionOrderId);
  assertOrderAllowsUploads(order);

  const body = await request.json();
  const pathname = String(body.pathname || "").trim();
  if (!pathname) throw new ValidationError("pathname requerido");
  if (pathname.includes("..")) {
    throw new ValidationError("pathname invalido");
  }

  const expectedPrefix = `production/${productionOrderId}/`;
  if (!pathname.startsWith(expectedPrefix)) {
    throw new ValidationError("El archivo no corresponde a esta orden");
  }

  const fileName =
    body.fileName ||
    sanitizeFileName(pathname.split("/").pop()) ||
    "archivo";
  const contentType = body.contentType || "application/octet-stream";
  if (!isAllowedAttachment(fileName, contentType)) {
    throw new ValidationError(
      "Tipo no permitido. Usa imagenes, PDF o archivos CAD"
    );
  }

  const sizeBytes = Number(body.sizeBytes) || 0;
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError("El archivo supera 50 MB");
  }

  const record = await persistAttachment({
    actor,
    productionOrderId,
    pathname,
    url: body.url || null,
    fileName,
    contentType,
    sizeBytes,
    kind: body.kind,
  });

  return jsonCreated(record);
}

export async function deleteProductionAttachment(
  request,
  productionOrderId,
  attachmentId
) {
  await requirePermission("production.update_progress");
  const actor = await getActor(request);
  const order = await findProductionOrThrow(productionOrderId);
  assertOrderAllowsUploads(order);

  const attachment = await prisma.productionAttachment.findFirst({
    where: { id: attachmentId, productionOrderId },
  });
  if (!attachment) throw new NotFoundError("Adjunto no encontrado");

  try {
    await del(attachment.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    /* ignore */
  }

  await prisma.productionAttachment.delete({ where: { id: attachmentId } });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionAttachment",
    entityId: attachmentId,
    action: AUDIT_ACTIONS.DELETE,
    previousData: {
      productionOrderId,
      fileName: attachment.fileName,
      pathname: attachment.pathname,
      kind: attachment.kind,
    },
  });

  return jsonOk({ ok: true });
}

/**
 * Referencia interna a la cotizacion origen (sin documentos comerciales).
 */
export async function getQuoteProductionDocsForOrder(order) {
  if (order.sourceType !== "QUOTE" || !order.quoteId) {
    return { quoteId: null, quoteFolio: null, attachments: [] };
  }
  return {
    quoteId: order.quoteId,
    quoteFolio: order.quote?.folio || null,
    attachments: [],
  };
}
