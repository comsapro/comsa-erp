import { lineAmount } from "@/lib/quotes/calculations";
import { recalculateQuote } from "./recalculate";

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
  if (quote.status !== "IN_PRODUCTION") return;

  const processes = await tx.productionItemProcess.findMany({
    where: {
      productionItem: { productionOrderId: productionOrder.id },
      status: { not: "REPLACED" },
    },
    include: {
      productionItem: {
        select: { sourceItemId: true, sourceItemType: true },
      },
    },
  });

  const hoursByLine = new Map();
  const extras = [];
  for (const process of processes) {
    const hours = Math.round((Number(process.realHours) || 0) * 1000) / 1000;
    if (process.quotedManufacturingId) {
      const prev = hoursByLine.get(process.quotedManufacturingId) || 0;
      hoursByLine.set(process.quotedManufacturingId, prev + hours);
    } else if (process.productionItem?.sourceItemType === "QUOTE_ITEM") {
      extras.push({ process, hours });
    }
  }

  for (const [lineId, hours] of hoursByLine) {
    const line = await tx.quoteItemManufacturing.findUnique({ where: { id: lineId } });
    if (!line) continue;
    const quantity = Math.round(hours * 1000) / 1000;
    await tx.quoteItemManufacturing.update({
      where: { id: lineId },
      data: {
        quantity,
        unitSnapshot: "HOUR",
        amount: lineAmount(quantity, Number(line.unitRate) || 0),
      },
    });
  }

  for (const { process, hours } of extras) {
    const quoteItemId = process.productionItem.sourceItemId;
    if (!quoteItemId) continue;
    let unitRate = 0;
    if (process.manufacturingProcessId) {
      const catalog = await tx.manufacturingProcess.findFirst({
        where: { id: process.manufacturingProcessId },
        select: { defaultRate: true },
      });
      unitRate = Number(catalog?.defaultRate) || 0;
    }
    const quantity = Math.round(hours * 1000) / 1000;
    await tx.quoteItemManufacturing.create({
      data: {
        quoteItemId,
        manufacturingProcessId: process.manufacturingProcessId || null,
        processNameSnapshot: process.processNameSnapshot || "Proceso",
        unitSnapshot: "HOUR",
        quantity,
        unitRate,
        amount: lineAmount(quantity, unitRate),
        observations: process.notes || null,
        sortOrder: process.sortOrder ?? 0,
      },
    });
  }

  await recalculateQuote(tx, quote.id);
  await tx.quote.update({
    where: { id: quote.id },
    data: {
      status: "SELLER_REVIEW",
      sellerReviewStartedAt: new Date(Date.now() + 1500),
      updatedBy: actorId || null,
    },
  });
}
