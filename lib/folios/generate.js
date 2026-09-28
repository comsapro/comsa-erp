import "server-only";
import { prisma } from "@/lib/db";

/**
 * Genera un folio YYMM-CONSECUTIVE-REVISION (ej. 2607-38-A).
 * Debe llamarse DENTRO de una transaccion Prisma para evitar duplicados.
 *
 * Usa upsert atómico sobre (scope, yearMonth) y reintenta ante P2002.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {"QUOTE"|"DIRECT_ORDER"|"PRODUCTION"|"INVENTORY_MOVEMENT"|"WAREHOUSE_TRANSFER"|"PURCHASE_ORDER"|"PURCHASE_RECEIPT"|"QUALITY_REWORK"} scope
 * @param {Date} [date]
 */
export async function generateFolio(tx, scope, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${yy}${mm}`;

  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const row = await tx.folioSequence.upsert({
        where: { scope_yearMonth: { scope, yearMonth } },
        create: { scope, yearMonth, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      return `${yearMonth}-${row.lastValue}-A`;
    } catch (err) {
      lastErr = err;
      // Carrera en el create inicial del periodo
      if (err?.code === "P2002" && attempt < 5) continue;
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Asegura que la secuencia no quede por debajo del maximo folio existente
 * del periodo (p. ej. tras import legado). Pensado para correr fuera de txs
 * de escritura de documentos.
 */
export async function ensureFolioSequenceAtLeast(tx, scope, yearMonth, minValue) {
  if (!yearMonth || !minValue) return;
  const existing = await tx.folioSequence.findUnique({
    where: { scope_yearMonth: { scope, yearMonth } },
  });
  if (!existing) {
    await tx.folioSequence.create({
      data: { scope, yearMonth, lastValue: minValue },
    });
    return;
  }
  if (existing.lastValue < minValue) {
    await tx.folioSequence.update({
      where: { id: existing.id },
      data: { lastValue: minValue },
    });
  }
}
