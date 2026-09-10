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
} from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";
import {
  canAccessSellerId,
  resolveSalesScope,
} from "@/domains/sales/scope";

export const MAX_INVOICE_FILE_BYTES = 25 * 1024 * 1024;
export const INVOICE_FILE_KINDS = ["PDF", "XML"];

function sanitizeFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function fileExtension(name) {
  const n = String(name || "").toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

function normalizeKind(raw) {
  const v = String(raw || "").toUpperCase();
  return INVOICE_FILE_KINDS.includes(v) ? v : null;
}

function isAllowedInvoiceFile(kind, fileName, contentType) {
  const ext = fileExtension(fileName);
  const ct = String(contentType || "").toLowerCase();
  if (kind === "PDF") {
    return ext === ".pdf" || ct === "application/pdf";
  }
  if (kind === "XML") {
    return (
      ext === ".xml" ||
      ct === "application/xml" ||
      ct === "text/xml" ||
      ct === "application/octet-stream"
    );
  }
  return false;
}

async function findInvoiceOrThrow(id, request) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, deletedAt: null },
  });
  if (!invoice) throw new NotFoundError("Factura no encontrada");
  const scope = await resolveSalesScope(request, {});
  if (!canAccessSellerId(scope, invoice.sellerId)) {
    throw new NotFoundError("Factura no encontrada");
  }
  return invoice;
}

function fileFields(kind, data) {
  if (kind === "PDF") {
    return {
      pdfPathname: data.pathname,
      pdfFileName: data.fileName,
      pdfUrl: data.url || null,
      pdfContentType: data.contentType,
      pdfSizeBytes: data.sizeBytes,
    };
  }
  return {
    xmlPathname: data.pathname,
    xmlFileName: data.fileName,
    xmlUrl: data.url || null,
    xmlContentType: data.contentType,
    xmlSizeBytes: data.sizeBytes,
  };
}

export async function persistInvoiceFile({
  actor,
  invoiceId,
  kind,
  pathname,
  url,
  fileName,
  contentType,
  sizeBytes,
}) {
  const normalized = normalizeKind(kind);
  if (!normalized) {
    throw new ValidationError("Tipo de archivo invalido (PDF o XML)");
  }
  if (!isAllowedInvoiceFile(normalized, fileName, contentType)) {
    throw new ValidationError(
      normalized === "PDF"
        ? "Solo se permite archivo PDF"
        : "Solo se permite archivo XML"
    );
  }

  const record = await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: {
      ...fileFields(normalized, {
        pathname,
        url,
        fileName: fileName || sanitizeFileName(pathname),
        contentType: contentType || "application/octet-stream",
        sizeBytes: Number(sizeBytes) || 0,
      }),
      updatedBy: actor?.id || undefined,
    },
  });

  if (actor) {
    await recordAudit({
      actor,
      module: "sales",
      entity: "SalesInvoice",
      entityId: invoiceId,
      action: AUDIT_ACTIONS.UPDATE,
      newData: {
        fileKind: normalized,
        fileName: record[normalized === "PDF" ? "pdfFileName" : "xmlFileName"],
        pathname,
      },
    });
  }

  return record;
}

export async function handleInvoiceFileUpload(request, invoiceId) {
  await requirePermission("sales.create_invoice");
  const actor = await getActor(request);
  await findInvoiceOrThrow(invoiceId, request);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ValidationError(
      "Almacenamiento Blob no configurado (BLOB_READ_WRITE_TOKEN)"
    );
  }

  const body = await request.json();
  let kind = null;
  try {
    const payload = body?.clientPayload
      ? JSON.parse(body.clientPayload || "{}")
      : body || {};
    kind = normalizeKind(payload.kind);
  } catch {
    kind = null;
  }
  if (!kind) {
    throw new ValidationError("Indica el tipo de archivo (PDF o XML)");
  }

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      let payloadKind = kind;
      try {
        const p = JSON.parse(clientPayload || "{}");
        if (p.kind) payloadKind = normalizeKind(p.kind) || payloadKind;
      } catch {
        /* ignore */
      }
      return {
        access: "private",
        maximumSizeInBytes: MAX_INVOICE_FILE_BYTES,
        addRandomSuffix: true,
        allowedContentTypes:
          payloadKind === "PDF"
            ? ["application/pdf"]
            : ["application/xml", "text/xml", "application/octet-stream"],
        tokenPayload: JSON.stringify({
          invoiceId,
          kind: payloadKind,
          userId: actor.id,
        }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      try {
        const payload = JSON.parse(tokenPayload || "{}");
        const fileKind = normalizeKind(payload.kind) || kind;
        const fileName = blob.pathname?.split("/").pop() || "archivo";
        if (!isAllowedInvoiceFile(fileKind, fileName, blob.contentType)) {
          try {
            await del(blob.url || blob.pathname, {
              token: process.env.BLOB_READ_WRITE_TOKEN,
            });
          } catch {
            /* ignore */
          }
          throw new ValidationError(
            fileKind === "PDF"
              ? "Solo se permite archivo PDF"
              : "Solo se permite archivo XML"
          );
        }
        await persistInvoiceFile({
          actor: payload.userId ? { id: payload.userId } : actor,
          invoiceId: payload.invoiceId || invoiceId,
          kind: fileKind,
          pathname: blob.pathname,
          url: blob.url,
          fileName,
          contentType: blob.contentType,
          sizeBytes: blob.size,
        });
      } catch (err) {
        console.error("[blob] invoice upload completed failed", err);
        throw err;
      }
    },
  });

  return Response.json(jsonResponse);
}

export async function registerInvoiceFile(request, invoiceId) {
  await requirePermission("sales.create_invoice");
  const actor = await getActor(request);
  await findInvoiceOrThrow(invoiceId, request);
  const body = await request.json();
  const kind = normalizeKind(body.kind);
  if (!kind) {
    throw new ValidationError("Indica el tipo de archivo (PDF o XML)");
  }
  if (!body.pathname) {
    throw new ValidationError("pathname es requerido");
  }

  const record = await persistInvoiceFile({
    actor,
    invoiceId,
    kind,
    pathname: body.pathname,
    url: body.url || null,
    fileName: body.fileName || body.pathname.split("/").pop() || "archivo",
    contentType: body.contentType || "application/octet-stream",
    sizeBytes: body.sizeBytes || 0,
  });

  return jsonOk(record);
}
