import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { del, get } from "@vercel/blob";
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

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB (client upload)
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const ALLOWED_TYPES = new Set(ALLOWED_CONTENT_TYPES);

function sanitizeFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function findQuoteItemOrThrow(quoteId, itemId) {
  const item = await prisma.quoteItem.findFirst({
    where: { id: itemId, quoteId },
    include: {
      quote: { select: { id: true, folio: true, status: true, deletedAt: true } },
    },
  });
  if (!item || item.quote?.deletedAt) {
    throw new NotFoundError("Partida no encontrada");
  }
  return item;
}

async function persistAttachment({
  actor,
  quoteId,
  itemId,
  pathname,
  url,
  fileName,
  contentType,
  sizeBytes,
}) {
  const existing = await prisma.quoteItemAttachment.findFirst({
    where: { pathname },
  });
  if (existing) return existing;

  const count = await prisma.quoteItemAttachment.count({
    where: { quoteItemId: itemId },
  });

  const record = await prisma.quoteItemAttachment.create({
    data: {
      quoteItemId: itemId,
      pathname,
      url: url || null,
      fileName: fileName || pathname.split("/").pop() || "archivo",
      contentType: contentType || "application/octet-stream",
      sizeBytes: Number(sizeBytes) || 0,
      sortOrder: count,
      createdBy: actor?.id || null,
      updatedBy: actor?.id || null,
    },
  });

  if (actor) {
    await recordAudit({
      actor,
      module: "quotes",
      entity: "QuoteItemAttachment",
      entityId: record.id,
      action: AUDIT_ACTIONS.CREATE,
      newData: {
        quoteId,
        itemId,
        fileName: record.fileName,
        pathname: record.pathname,
        sizeBytes: record.sizeBytes,
      },
    });
  }

  return record;
}

export async function listItemAttachments(request, quoteId, itemId) {
  await requirePermission("quotes.view");
  await findQuoteItemOrThrow(quoteId, itemId);
  const rows = await prisma.quoteItemAttachment.findMany({
    where: { quoteItemId: itemId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return jsonOk(rows);
}

/**
 * Client upload token + callback (soporta hasta 50 MB).
 * El archivo va directo a Vercel Blob, no pasa por el body del Route Handler.
 */
export async function handleItemAttachmentUpload(request, quoteId, itemId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const item = await findQuoteItemOrThrow(quoteId, itemId);

  if (item.quote.status !== "DRAFT") {
    throw new ConflictError(
      "Solo se pueden adjuntar archivos en cotizaciones en borrador"
    );
  }

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
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
      addRandomSuffix: true,
      tokenPayload: JSON.stringify({
        quoteId,
        itemId,
        userId: actor.id,
      }),
    }),
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      // En localhost este webhook no siempre llega; el cliente tambien registra.
      try {
        const payload = JSON.parse(tokenPayload || "{}");
        const qId = payload.quoteId || quoteId;
        const iId = payload.itemId || itemId;
        await persistAttachment({
          actor: payload.userId ? { id: payload.userId } : actor,
          quoteId: qId,
          itemId: iId,
          pathname: blob.pathname,
          url: blob.url,
          fileName: blob.pathname?.split("/").pop() || "archivo",
          contentType: blob.contentType,
          sizeBytes: blob.size,
        });
      } catch (err) {
        console.error("[blob] onUploadCompleted failed", err);
        throw err;
      }
    },
  });

  return Response.json(jsonResponse);
}

/**
 * Registra metadata tras upload del cliente (necesario en local y como respaldo).
 */
export async function registerItemAttachment(request, quoteId, itemId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const item = await findQuoteItemOrThrow(quoteId, itemId);

  if (item.quote.status !== "DRAFT") {
    throw new ConflictError(
      "Solo se pueden adjuntar archivos en cotizaciones en borrador"
    );
  }

  const body = await request.json();
  const pathname = String(body.pathname || "").trim();
  if (!pathname) throw new ValidationError("pathname requerido");
  if (pathname.includes("..")) {
    throw new ValidationError("pathname invalido");
  }

  const expectedPrefix = `quotes/${quoteId}/items/${itemId}/`;
  if (!pathname.startsWith(expectedPrefix)) {
    throw new ValidationError("El archivo no corresponde a esta partida");
  }

  const contentType = body.contentType || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ValidationError(
      "Tipo no permitido. Usa JPG, PNG, WEBP, GIF o PDF"
    );
  }

  const sizeBytes = Number(body.sizeBytes) || 0;
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError("El archivo supera 50 MB");
  }

  const record = await persistAttachment({
    actor,
    quoteId,
    itemId,
    pathname,
    url: body.url || null,
    fileName: body.fileName || sanitizeFileName(pathname.split("/").pop()),
    contentType,
    sizeBytes,
  });

  return jsonCreated(record);
}

export async function deleteItemAttachment(
  request,
  quoteId,
  itemId,
  attachmentId
) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const item = await findQuoteItemOrThrow(quoteId, itemId);

  if (item.quote.status !== "DRAFT") {
    throw new ConflictError(
      "Solo se pueden eliminar adjuntos en cotizaciones en borrador"
    );
  }

  const attachment = await prisma.quoteItemAttachment.findFirst({
    where: { id: attachmentId, quoteItemId: itemId },
  });
  if (!attachment) throw new NotFoundError("Adjunto no encontrado");

  try {
    await del(attachment.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Si el blob ya no existe, igual borramos el registro
  }

  await prisma.quoteItemAttachment.delete({ where: { id: attachmentId } });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "QuoteItemAttachment",
    entityId: attachmentId,
    action: AUDIT_ACTIONS.DELETE,
    previousData: {
      quoteId,
      itemId,
      fileName: attachment.fileName,
      pathname: attachment.pathname,
    },
  });

  return jsonOk({ ok: true });
}

/**
 * Sirve un blob privado autenticado. Valida que el pathname pertenezca
 * a un adjunto de cotizacion visible para el usuario.
 */
export async function servePrivateBlob(request) {
  await requirePermission("quotes.view");

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");
  if (!pathname) {
    throw new ValidationError("Missing pathname");
  }

  const attachment = await prisma.quoteItemAttachment.findFirst({
    where: { pathname },
    include: {
      quoteItem: {
        select: {
          quote: { select: { deletedAt: true } },
        },
      },
    },
  });
  if (!attachment || attachment.quoteItem?.quote?.deletedAt) {
    throw new NotFoundError("Archivo no encontrado");
  }

  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new NotFoundError("Archivo no encontrado en almacenamiento");
  }

  const contentType =
    result.blob?.contentType || attachment.contentType || "application/octet-stream";

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
