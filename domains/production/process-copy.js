import { quotedHoursFromManufacturing } from "./process-rules";

export function manufacturingToProcessData(row, { actorId = null, sourceType = "QUOTATION" } = {}) {
  const hours = quotedHoursFromManufacturing(row);
  return {
    sourceType,
    quotedManufacturingId: sourceType === "QUOTATION" ? row.id : null,
    manufacturingProcessId: row.manufacturingProcessId || null,
    processNameSnapshot: row.processNameSnapshot || row.name || "Proceso",
    unitSnapshot: row.unitSnapshot || "HOUR",
    quotedHours: hours,
    expectedHours: hours,
    realHours: 0,
    status: "PENDING",
    sortOrder: row.sortOrder ?? 0,
    notes: row.observations || null,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

export async function copyQuotedProcessesToItem(tx, productionItemId, quoteItemId, actorId = null) {
  const rows = await tx.quoteItemManufacturing.findMany({
    where: { quoteItemId },
    orderBy: { sortOrder: "asc" },
  });
  if (!rows.length) return [];
  const created = [];
  for (const row of rows) {
    const process = await tx.productionItemProcess.create({
      data: {
        productionItemId,
        ...manufacturingToProcessData(row, { actorId, sourceType: "QUOTATION" }),
      },
    });
    created.push(process);
  }
  return created;
}

export async function copyQuotedProcessesForOrderItems(tx, productionItems, actorId = null) {
  for (const item of productionItems) {
    if (item.sourceItemType !== "QUOTE_ITEM" || !item.sourceItemId) continue;
    const existing = await tx.productionItemProcess.count({
      where: { productionItemId: item.id },
    });
    if (existing > 0) continue;
    await copyQuotedProcessesToItem(tx, item.id, item.sourceItemId, actorId);
  }
}
