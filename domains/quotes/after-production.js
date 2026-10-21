import { prisma } from "@/lib/db";
import { lineAmount, toNumber } from "@/lib/quotes/calculations";
import { recalculateQuote } from "./recalculate";
import { syncCompanionDirectOrderStatus } from "@/domains/direct-orders/status-sync";
import {
  hoursPerPiece,
  manufacturingQuantityFromProduction,
  reportedProductionHours,
} from "./production-hours";

function lineKey(process, quoteItemId) {
  return `${quoteItemId}:${process.manufacturingProcessId || process.processNameSnapshot || "proceso"}`;
}

async function writeManufacturingHours(tx, line, perPieceHours) {
  const next = manufacturingQuantityFromProduction(toNumber(line.quantity), perPieceHours);
  if (next <= toNumber(line.quantity) + 0.0001) return false;
  await tx.quoteItemManufacturing.update({
    where: { id: line.id },
    data: {
      quantity: next,
      unitSnapshot: "HOUR",
      amount: lineAmount(next, toNumber(line.unitRate)),
    },
  });
  return true;
}

/**
 * Copia a la cotización, por pieza, las horas que producción reportó.
 * No baja una cantidad que el vendedor ya haya dejado más alta.
 */
export async function applyReportedHoursToQuote(tx, productionOrder, actorId) {
  const quoteId = productionOrder?.quoteId;
  if (!quoteId) return false;

  const quote = await tx.quote.findFirst({
    where: { id: quoteId, deletedAt: null },
  });
  if (!quote?.priceAfterProduction) return false;

  const processes = await tx.productionItemProcess.findMany({
    where: {
      productionItem: { productionOrderId: productionOrder.id },
      status: { not: "REPLACED" },
    },
    include: {
      sessions: true,
      productionItem: {
        select: { sourceItemId: true, sourceItemType: true, quantity: true },
      },
    },
  });

  const perPieceByLine = new Map();
  const unmatched = new Map();

  for (const process of processes) {
    const reported = reportedProductionHours(process);
    if (reported <= 0) continue;
    const perPiece = hoursPerPiece(reported, process.productionItem?.quantity);
    if (perPiece <= 0) continue;

    if (process.quotedManufacturingId) {
      perPieceByLine.set(
        process.quotedManufacturingId,
        (perPieceByLine.get(process.quotedManufacturingId) || 0) + perPiece
      );
      continue;
    }

    if (process.productionItem?.sourceItemType !== "QUOTE_ITEM") continue;
    const quoteItemId = process.productionItem.sourceItemId;
    if (!quoteItemId) continue;
    const key = lineKey(process, quoteItemId);
    const prev = unmatched.get(key) || { process, quoteItemId, perPiece: 0 };
    prev.perPiece += perPiece;
    unmatched.set(key, prev);
  }

  let changed = false;

  for (const [lineId, perPiece] of perPieceByLine) {
    const line = await tx.quoteItemManufacturing.findUnique({ where: { id: lineId } });
    if (!line) continue;
    if (await writeManufacturingHours(tx, line, perPiece)) changed = true;
  }

  for (const { process, quoteItemId, perPiece } of unmatched.values()) {
    const existing = await tx.quoteItemManufacturing.findFirst({
      where: {
        quoteItemId,
        ...(process.manufacturingProcessId
          ? { manufacturingProcessId: process.manufacturingProcessId }
          : { processNameSnapshot: process.processNameSnapshot || "Proceso" }),
      },
    });
    if (existing) {
      if (await writeManufacturingHours(tx, existing, perPiece)) changed = true;
      continue;
    }

    let unitRate = 0;
    if (process.manufacturingProcessId) {
      const catalog = await tx.manufacturingProcess.findFirst({
        where: { id: process.manufacturingProcessId },
        select: { defaultRate: true },
      });
      unitRate = toNumber(catalog?.defaultRate);
    }
    await tx.quoteItemManufacturing.create({
      data: {
        quoteItemId,
        manufacturingProcessId: process.manufacturingProcessId || null,
        processNameSnapshot: process.processNameSnapshot || "Proceso",
        unitSnapshot: "HOUR",
        quantity: perPiece,
        unitRate,
        amount: lineAmount(perPiece, unitRate),
        observations: process.notes || null,
        sortOrder: process.sortOrder ?? 0,
      },
    });
    changed = true;
  }

  if (changed) {
    await recalculateQuote(tx, quote.id);
    await tx.quote.update({
      where: { id: quote.id },
      data: { updatedBy: actorId || null },
    });
  }
  return changed;
}

export async function ensureQuoteManufacturingHours(quoteId, actorId) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deletedAt: null },
    select: { id: true, priceAfterProduction: true, productionOrderId: true },
  });
  if (!quote?.priceAfterProduction || !quote.productionOrderId) return false;
  const productionOrder = await prisma.productionOrder.findFirst({
    where: { id: quote.productionOrderId },
  });
  if (!productionOrder) return false;
  return prisma.$transaction((tx) =>
    applyReportedHoursToQuote(tx, productionOrder, actorId)
  );
}

/**
 * Al cerrar la orden de produccion de una orden directa, copia las horas reales
 * a las lineas de manufactura y regresa la cotizacion al vendedor.
 */
export async function handbackPriceAfterProduction(tx, productionOrder, actorId) {
  const quoteId = productionOrder?.quoteId;
  if (!quoteId) return;

  const quote = await tx.quote.findFirst({
    where: { id: quoteId, deletedAt: null },
  });
  if (!quote?.priceAfterProduction) return;

  await applyReportedHoursToQuote(tx, productionOrder, actorId);
  if (quote.status !== "IN_PRODUCTION") return;

  await tx.quote.update({
    where: { id: quote.id },
    data: {
      status: "SELLER_REVIEW",
      sellerReviewStartedAt: new Date(Date.now() + 1500),
      updatedBy: actorId || null,
    },
  });
  await syncCompanionDirectOrderStatus(
    tx,
    { ...quote, status: "SELLER_REVIEW" },
    actorId
  );
}
