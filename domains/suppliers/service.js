import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { NotFoundError } from "@/lib/permissions/errors";
import { jsonOk } from "@/lib/api/http";

/** Perfil enriquecido de proveedor: maestro + OC / recepciones / cotizaciones. */
export async function getSupplierProfile(request, id) {
  await requirePermission("suppliers.view");
  const supplier = await prisma.supplier.findFirst({
    where: { id, deletedAt: null },
  });
  if (!supplier) throw new NotFoundError();

  const [purchaseOrders, receipts, materialQuoteIds, extraQuoteIds] =
    await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { supplierId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          folio: true,
          status: true,
          total: true,
          requestDate: true,
          createdAt: true,
          quote: { select: { id: true, folio: true } },
          productionOrder: { select: { id: true, folio: true } },
        },
      }),
      prisma.purchaseReceipt.findMany({
        where: { supplierId: id },
        orderBy: { receiptDate: "desc" },
        take: 20,
        select: {
          id: true,
          folio: true,
          receiptDate: true,
          notes: true,
          createdAt: true,
          purchaseOrder: { select: { id: true, folio: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.quoteItemMaterial.findMany({
        where: { supplierId: id },
        select: { quoteItem: { select: { quoteId: true } } },
        take: 100,
      }),
      prisma.quoteItemExtra.findMany({
        where: { supplierId: id },
        select: { quoteItem: { select: { quoteId: true } } },
        take: 100,
      }),
    ]);

  const quoteIdSet = new Set();
  for (const row of materialQuoteIds) {
    if (row.quoteItem?.quoteId) quoteIdSet.add(row.quoteItem.quoteId);
  }
  for (const row of extraQuoteIds) {
    if (row.quoteItem?.quoteId) quoteIdSet.add(row.quoteItem.quoteId);
  }
  for (const po of purchaseOrders) {
    if (po.quote?.id) quoteIdSet.add(po.quote.id);
  }

  const linkedQuotes =
    quoteIdSet.size === 0
      ? []
      : await prisma.quote.findMany({
          where: { id: { in: [...quoteIdSet] }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            folio: true,
            status: true,
            total: true,
            currency: true,
            elaborationDate: true,
            createdAt: true,
            client: { select: { id: true, commercialName: true } },
          },
        });

  return jsonOk({
    ...supplier,
    history: {
      purchaseOrders,
      receipts,
      linkedQuotes,
    },
  });
}
