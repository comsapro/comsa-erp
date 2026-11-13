import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { getActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { prisma } from "@/lib/db";

const MAX_CERTIFICATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

export async function handleInstrumentCalibrationUpload(request, instrumentId) {
  await requirePermission("quality.manage_calibrations");
  const actor = await getActor(request);
  const instrument = await prisma.measuringInstrument.findFirst({
    where: { id: instrumentId, deletedAt: null },
    select: { id: true },
  });
  if (!instrument) throw new NotFoundError("Instrumento no encontrado");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ValidationError(
      "Almacenamiento Blob no configurado (BLOB_READ_WRITE_TOKEN)"
    );
  }

  const body = await request.json();
  const prefix = `quality/instruments/${instrumentId}/calibrations/`;
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(prefix) || pathname.includes("..")) {
        throw new ValidationError(
          "El archivo no corresponde a este instrumento"
        );
      }
      if (!ALLOWED_EXTENSIONS.test(pathname)) {
        throw new ValidationError("Adjunta un certificado PDF, JPG o PNG");
      }
      return {
        access: "private",
        maximumSizeInBytes: MAX_CERTIFICATE_BYTES,
        addRandomSuffix: true,
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        tokenPayload: JSON.stringify({ instrumentId, userId: actor.id }),
      };
    },
    onUploadCompleted: async ({ blob }) => {
      const fileName = blob.pathname?.split("/").pop() || "";
      if (
        !blob.pathname?.startsWith(prefix) ||
        !ALLOWED_EXTENSIONS.test(fileName) ||
        !ALLOWED_CONTENT_TYPES.includes(blob.contentType)
      ) {
        throw new ValidationError("El certificado tiene un formato no permitido");
      }
    },
  });

  return Response.json(jsonResponse);
}
