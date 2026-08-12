import { withErrorHandling } from "@/lib/api/http";
import { servePrivateBlob } from "@/domains/quotes/attachments";

/**
 * Sirve blobs privados de adjuntos (cotizacion, plantillas, produccion).
 * Uso: GET /api/blob?pathname=quotes/.../archivo.jpg
 */
export const GET = withErrorHandling(async (req) => servePrivateBlob(req));
