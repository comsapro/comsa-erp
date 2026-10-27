import { withErrorHandling } from "@/lib/api/http";
import { getQualityDailyDigest } from "@/domains/quality/service";

/** Resumen diario NC / retrabajos abiertos (listo para cron / correo futuro). */
export const GET = withErrorHandling((req) => getQualityDailyDigest(req));
