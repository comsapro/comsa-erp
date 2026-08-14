import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { copy, del, get } from "@vercel/blob";
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

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB
export const ATTACHMENT_AUDIENCES = ["SALES", "PRODUCTION"];

/** Extensiones CAD / documentos industriales + imagenes / PDF */
export const ALLOWED_EXTENSIONS = [
  // imagenes / docs
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  // CAD / manufactura
  ".step",
  ".stp",
  ".sldprt",
  ".sldasm",
  ".slddrw",
  ".dxf",
  ".dwg",
  ".x_t",
  ".x_b",
  ".iges",
  ".igs",
  ".stl",
  ".obj",
  ".3mf",
  ".prt",
  ".asm",
];

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/octet-stream",
  "application/step",
  "model/step",
  "image/vnd.dxf",
  "application/dxf",
  "application/acad",
  "image/vnd.dwg",
  "application/acad",
  "model/stl",
  "application/sla",
  "text/plain",
];

const ALLOWED_TYPES = new Set(ALLOWED_CONTENT_TYPES);
const ALLOWED_EXT = new Set(ALLOWED_EXTENSIONS);

export function sanitizeFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function fileExtension(name) {
  const n = String(name || "").toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

export function isAllowedAttachment(fileName, contentType) {
  const ext = fileExtension(fileName);
  if (ext && ALLOWED_EXT.has(ext)) return true;
  const ct = String(contentType || "").toLowerCase();
  if (ct && ALLOWED_TYPES.has(ct) && ct !== "application/octet-stream") {
    return true;
  }
  // octet-stream solo si hay extension conocida
  return false;
}

function normalizeAudience(raw) {
  const v = String(raw || "SALES").toUpperCase();
  return ATTACHMENT_AUDIENCES.includes(v) ? v : "SALES";
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
  audience = "SALES",
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
      audience: normalizeAudience(audience),
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
        audience: record.audience,
        sizeBytes: record.sizeBytes,
      },
    });
  }

  return record;
}

/**
 * Copia blobs de una lista de adjuntos hacia una partida destino.
 */
export async function copyAttachmentsToQuoteItem({
  sources = [],
  destQuoteId,
  destItemId,
  actorId = null,
}) {
  if (!sources.length) return [];
  const created = [];
  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i];
    const safe = sanitizeFileName(src.fileName || `archivo-${i}`);
    const destPath = `quotes/${destQuoteId}/items/${destItemId}/${Date.now()}-${i}-${safe}`;
    try {
      const blob = await copy(src.pathname, destPath, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const row = await prisma.quoteItemAttachment.create({
        data: {
          quoteItemId: destItemId,
          pathname: blob.pathname || destPath,
          url: blob.url || null,
          fileName: src.fileName || safe,
          contentType: src.contentType || "application/octet-stream",
          sizeBytes: Number(src.sizeBytes) || 0,
          audience: normalizeAudience(src.audience),
          sortOrder: i,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      created.push(row);
    } catch (err) {
      console.error("[blob] copy attachment failed", src.pathname, err);
    }
  }
  return created;
}

/**
 * Copia adjuntos de partida a plantilla de biblioteca.
 */
export async function copyAttachmentsToTemplate({
  sources = [],
  templateId,
  actorId = null,
}) {
  if (!sources.length) return [];
  const created = [];
  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i];
    const safe = sanitizeFileName(src.fileName || `archivo-${i}`);
    const destPath = `templates/${templateId}/${Date.now()}-${i}-${safe}`;
    try {
      const blob = await copy(src.pathname, destPath, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const row = await prisma.quoteItemTemplateAttachment.create({
        data: {
          templateId,
          pathname: blob.pathname || destPath,
          url: blob.url || null,
          fileName: src.fileName || safe,
          contentType: src.contentType || "application/octet-stream",
          sizeBytes: Number(src.sizeBytes) || 0,
          audience: normalizeAudience(src.audience),
          sortOrder: i,
          createdBy: actorId,
        },
      });
      created.push(row);
    } catch (err) {
      console.error("[blob] copy template attachment failed", src.pathname, err);
    }
  }
  return created;
}

export async function listItemAttachments(request, quoteId, itemId) {
  await requirePermission("quotes.view");
  await findQuoteItemOrThrow(quoteId, itemId);
  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience");
  const where = { quoteItemId: itemId };
  if (ATTACHMENT_AUDIENCES.includes(String(audience || "").toUpperCase())) {
    where.audience = String(audience).toUpperCase();
  }
  const rows = await prisma.quoteItemAttachment.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return jsonOk(rows);
}

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
  const audience = normalizeAudience(body?.clientPayload
    ? JSON.parse(body.clientPayload || "{}").audience
    : body?.audience);

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      let payloadAudience = audience;
      try {
        const p = JSON.parse(clientPayload || "{}");
        if (p.audience) payloadAudience = normalizeAudience(p.audience);
      } catch {
        /* ignore */
      }
      return {
        access: "private",
        // CAD (STEP, SLDPRT, etc.) suele llegar como octet-stream o sin MIME fiable.
        // La validacion real es por extension en registerItemAttachment.
        maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({
          quoteId,
          itemId,
          userId: actor.id,
          audience: payloadAudience,
        }),
      };
    },
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
            "Tipo no permitido. Usa imagenes, PDF o archivos CAD (STEP, SLDPRT, SLDASM, DXF, x_t, etc.)"
          );
        }
        await persistAttachment({
          actor: payload.userId ? { id: payload.userId } : actor,
          quoteId: payload.quoteId || quoteId,
          itemId: payload.itemId || itemId,
          pathname: blob.pathname,
          url: blob.url,
          fileName,
          contentType: blob.contentType,
          sizeBytes: blob.size,
          audience: payload.audience || "SALES",
        });
      } catch (err) {
        console.error("[blob] onUploadCompleted failed", err);
        throw err;
      }
    },
  });

  return Response.json(jsonResponse);
}

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

  const fileName = body.fileName || pathname.split("/").pop() || "archivo";
  const contentType = body.contentType || "application/octet-stream";
  if (!isAllowedAttachment(fileName, contentType)) {
    throw new ValidationError(
      "Tipo no permitido. Usa imagenes, PDF o archivos CAD (STEP, SLDPRT, SLDASM, DXF, x_t, etc.)"
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
    fileName,
    contentType,
    sizeBytes,
    audience: body.audience,
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
    /* ignore */
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
      audience: attachment.audience,
    },
  });

  return jsonOk({ ok: true });
}

export async function servePrivateBlob(request) {
  const { requirePermission } = await import(
    "@/lib/permissions/require-permission"
  );

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");
  if (!pathname) {
    throw new ValidationError("Missing pathname");
  }

  const quoteAttachment = await prisma.quoteItemAttachment.findFirst({
    where: { pathname },
    include: {
      quoteItem: {
        select: { quote: { select: { deletedAt: true } } },
      },
    },
  });
  if (quoteAttachment) {
    await requirePermission("quotes.view");
    if (quoteAttachment.quoteItem?.quote?.deletedAt) {
      throw new NotFoundError("Archivo no encontrado");
    }
    return streamBlob(pathname, quoteAttachment);
  }

  const templateAttachment = await prisma.quoteItemTemplateAttachment.findFirst({
    where: { pathname },
  });
  if (templateAttachment) {
    await requirePermission("quotes.view");
    return streamBlob(pathname, templateAttachment);
  }

  const productionAttachment = await prisma.productionAttachment.findFirst({
    where: { pathname },
  });
  if (productionAttachment) {
    await requirePermission("production.view");
    return streamBlob(pathname, productionAttachment);
  }

  throw new NotFoundError("Archivo no encontrado");
}

async function streamBlob(pathname, attachment) {
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
      "Content-Disposition": `inline; filename="${String(attachment.fileName || "archivo").replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
