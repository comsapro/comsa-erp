import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { getActor } from "@/lib/api/actor";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { ValidationError, NotFoundError } from "@/lib/permissions/errors";
import { prisma } from "@/lib/db";

const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function isImage(fileName, contentType) {
  if (contentType && IMAGE_TYPES.has(String(contentType).toLowerCase())) {
    return true;
  }
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(String(fileName || ""));
}

export async function handleQualityEvidenceUpload(request) {
  await requireAnyPermission([
    "quality.inspect",
    "quality.record_ncr",
    "quality.create_rework",
    "quality.special_inspections",
  ]);
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const productionItemId = searchParams.get("productionItemId");
  if (!productionItemId) {
    throw new ValidationError("productionItemId requerido");
  }

  const item = await prisma.productionItem.findFirst({
    where: { id: productionItemId },
    select: { id: true, productionOrderId: true },
  });
  if (!item) throw new NotFoundError("Partida no encontrada");

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
      maximumSizeInBytes: MAX_BYTES,
      addRandomSuffix: true,
      allowedContentTypes: [...IMAGE_TYPES],
      tokenPayload: JSON.stringify({
        productionItemId: item.id,
        productionOrderId: item.productionOrderId,
        userId: actor.id,
      }),
    }),
    onUploadCompleted: async ({ blob }) => {
      const fileName = blob.pathname?.split("/").pop() || "evidencia.jpg";
      if (!isImage(fileName, blob.contentType)) {
        throw new ValidationError("Solo se aceptan imagenes de la pieza");
      }
    },
  });

  return Response.json(jsonResponse);
}
