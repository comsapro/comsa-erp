import { quotedHoursFromManufacturing } from "./process-rules";
import { expectedHoursFromQuoted } from "./handicap";

export function manufacturingToProcessData(
  row,
  { actorId = null, sourceType = "QUOTATION", handicapPercent = 0 } = {}
) {
  const hours = quotedHoursFromManufacturing(row);
  const expected =
    sourceType === "QUOTATION"
      ? expectedHoursFromQuoted(hours, handicapPercent)
      : Number(row.quantity) || 0;
  return {
    sourceType,
    quotedManufacturingId: sourceType === "QUOTATION" ? row.id : null,
    manufacturingProcessId: row.manufacturingProcessId || null,
    processNameSnapshot: row.processNameSnapshot || row.name || "Proceso",
    unitSnapshot: row.unitSnapshot || "HOUR",
    quotedHours: hours,
    expectedHours: expected,
    handicapSnapshot: handicapPercent,
    realHours: 0,
    status: "PENDING",
    sortOrder: row.sortOrder ?? 0,
    notes: row.observations || null,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

export async function getActiveHandicapPercent(tx) {
  try {
    const row = await tx.productionSetting.findUnique({
      where: { id: "default" },
    });
    return Number(row?.handicapPercent) || 0;
  } catch {
    return 0;
  }
}

export async function copyQuotedProcessesToItem(
  tx,
  productionItemId,
  quoteItemId,
  actorId = null
) {
  const rows = await tx.quoteItemManufacturing.findMany({
    where: { quoteItemId },
    orderBy: { sortOrder: "asc" },
  });
  if (!rows.length) return [];
  const handicapPercent = await getActiveHandicapPercent(tx);
  const created = [];
  for (const row of rows) {
    const process = await tx.productionItemProcess.create({
      data: {
        productionItemId,
        ...manufacturingToProcessData(row, {
          actorId,
          sourceType: "QUOTATION",
          handicapPercent,
        }),
      },
    });
    created.push(process);
  }
  return created;
}

export async function copyQuotedProcessesForOrderItems(
  tx,
  productionItems,
  actorId = null
) {
  for (const item of productionItems) {
    if (item.sourceItemType !== "QUOTE_ITEM" || !item.sourceItemId) continue;
    const existing = await tx.productionItemProcess.count({
      where: { productionItemId: item.id },
    });
    if (existing > 0) continue;
    await copyQuotedProcessesToItem(tx, item.id, item.sourceItemId, actorId);
  }
}
