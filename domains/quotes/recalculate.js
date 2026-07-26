import "server-only";
import {
  calculateQuoteItemTotals,
  calculateQuoteHeaderTotals,
  lineAmount,
} from "@/lib/quotes/calculations";

/**
 * Recalcula importes de lineas, totales de items y totales del encabezado.
 * Debe ejecutarse dentro de una transaccion Prisma (`tx`).
 */
export async function recalculateQuote(tx, quoteId) {
  const items = await tx.quoteItem.findMany({
    where: { quoteId },
    include: {
      manufacturing: { orderBy: { sortOrder: "asc" } },
      materials: true,
      extras: true,
      installations: true,
    },
    orderBy: { position: "asc" },
  });

  const itemTotals = [];

  for (const item of items) {
    for (const row of item.manufacturing) {
      const amount = lineAmount(row.quantity, row.unitRate);
      await tx.quoteItemManufacturing.update({
        where: { id: row.id },
        data: { amount },
      });
      row.amount = amount;
    }

    for (const row of item.materials) {
      const amount = lineAmount(row.quantity, row.unitPrice);
      await tx.quoteItemMaterial.update({
        where: { id: row.id },
        data: { amount },
      });
      row.amount = amount;
    }

    for (const row of item.extras) {
      const amount = lineAmount(row.quantity, row.unitPrice);
      await tx.quoteItemExtra.update({
        where: { id: row.id },
        data: { amount },
      });
      row.amount = amount;
    }

    for (const row of item.installations) {
      const amount = lineAmount(row.quantity, row.unitPrice);
      await tx.quoteItemInstallation.update({
        where: { id: row.id },
        data: { amount },
      });
      row.amount = amount;
    }

    const totals = calculateQuoteItemTotals({
      manufacturing: item.manufacturing,
      materials: item.materials,
      extras: item.extras,
      installations: item.installations,
      benefitPercentage: item.benefitPercentage,
      discountPercentage: item.discountPercentage,
    });

    const updated = await tx.quoteItem.update({
      where: { id: item.id },
      data: totals,
    });
    itemTotals.push({ ...updated, ...totals, status: item.status });
  }

  // Totales de cabecera solo con partidas activas (inactivas no cotizan / no PDF)
  const headerTotals = calculateQuoteHeaderTotals(
    itemTotals.filter((it) => it.status === "ACTIVE")
  );

  return tx.quote.update({
    where: { id: quoteId },
    data: headerTotals,
    include: {
      client: { select: { id: true, commercialName: true } },
      seller: { select: { id: true, name: true, email: true } },
      issuingCompany: {
        select: { id: true, commercialName: true, legalName: true },
      },
      items: {
        orderBy: { position: "asc" },
        include: {
          manufacturing: { orderBy: { sortOrder: "asc" } },
          materials: true,
          extras: true,
          installations: true,
        },
      },
    },
  });
}
