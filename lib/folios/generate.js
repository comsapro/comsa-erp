import "server-only";
import { prisma } from "@/lib/db";

/**
 * Genera un folio YYMM-CONSECUTIVE-REVISION (ej. 2607-38-A).
 * Debe llamarse DENTRO de una transaccion Prisma para evitar duplicados.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {"QUOTE"|"DIRECT_ORDER"|"PRODUCTION"|"INVENTORY_MOVEMENT"|"WAREHOUSE_TRANSFER"|"PURCHASE_ORDER"|"PURCHASE_RECEIPT"} scope
 * @param {Date} [date]
 */
export async function generateFolio(tx, scope, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${yy}${mm}`;

  const existing = await tx.folioSequence.findUnique({
    where: { scope_yearMonth: { scope, yearMonth } },
  });

  let nextValue;
  if (existing) {
    const updated = await tx.folioSequence.update({
      where: { id: existing.id },
      data: { lastValue: { increment: 1 } },
    });
    nextValue = updated.lastValue;
  } else {
    const created = await tx.folioSequence.create({
      data: { scope, yearMonth, lastValue: 1 },
    });
    nextValue = created.lastValue;
  }

  return `${yearMonth}-${nextValue}-A`;
}
