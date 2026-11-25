/**
 * Rechazo automatico de cotizaciones rezagadas: Borrador y En revision cuya
 * fecha de emision tiene mas de STALE_MONTHS meses. Lo ejecuta el cron diario
 * (app/api/cron/cotizaciones-vencidas) y puede correrse a mano desde un script.
 *
 * Sin dependencias de Next ("server-only", alias @/) para poder usarse desde
 * scripts de Node con su propio PrismaClient.
 */

export const STALE_MONTHS = 3;
export const STALE_STATUSES = ["DRAFT", "PENDING_APPROVAL"];
export const STALE_REJECTION_REASON =
  "COTIZACION NO UTILIZADA , QUEDO RESAGADA CON EL TIEMPO";

const BUSINESS_TZ = "America/Mexico_City";

/**
 * Fecha de corte (medianoche UTC, igual que los campos @db.Date): hoy en
 * Mexico menos `months` meses. Se rechaza lo emitido ANTES de esta fecha.
 */
export function staleCutoffDate(now = new Date(), months = STALE_MONTHS) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map(Number);
  const targetMonth = m - 1 - months;
  const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ now?: Date, dryRun?: boolean, batchSize?: number }} [options]
 */
export async function rejectStaleQuotes(prisma, options = {}) {
  const { now = new Date(), dryRun = false, batchSize = 200 } = options;
  const cutoff = staleCutoffDate(now);

  const candidates = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      status: { in: STALE_STATUSES },
      elaborationDate: { lt: cutoff },
    },
    select: { id: true, folio: true, status: true, elaborationDate: true },
    orderBy: { elaborationDate: "asc" },
  });

  const byStatus = {};
  for (const q of candidates) byStatus[q.status] = (byStatus[q.status] || 0) + 1;

  let rejected = 0;
  if (!dryRun) {
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      rejected += await prisma.$transaction(async (tx) => {
        const { count } = await tx.quote.updateMany({
          // Revalida el estatus por si alguien la movio mientras corria.
          where: { id: { in: batch.map((q) => q.id) }, status: { in: STALE_STATUSES } },
          data: {
            status: "REJECTED",
            rejectedAt: now,
            rejectedBy: null,
            rejectionReason: STALE_REJECTION_REASON,
            approvedBy: null,
            approvedAt: null,
          },
        });
        await tx.auditLog.createMany({
          data: batch.map((q) => ({
            userId: null,
            module: "quotes",
            entity: "Quote",
            entityId: q.id,
            action: "reject",
            previousData: { status: q.status },
            newData: {
              status: "REJECTED",
              rejectionReason: STALE_REJECTION_REASON,
              automatic: true,
            },
          })),
        });
        return count;
      });
    }
  }

  return {
    cutoff: cutoff.toISOString().slice(0, 10),
    candidates: candidates.length,
    byStatus,
    rejected,
    dryRun,
  };
}
