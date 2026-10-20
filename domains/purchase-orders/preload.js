import { itemQuantity } from "../../lib/quotes/calculations.js";

function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/**
 * Material de cotizacion -> fila precargable para la OC.
 * La cantidad del material es por pieza y se multiplica por las piezas de la partida;
 * en cotizaciones legacy (perPiece: false) ya es el total.
 * includeCost: el costo cotizado solo se expone a quien puede ver costos.
 */
export function toPreloadMaterial(
  mat,
  { pieces = 1, perPiece = true, includeCost = false } = {}
) {
  const quantityPerPiece = Number(mat.quantity) || 0;
  const factor = perPiece ? itemQuantity(pieces) : 1;
  return {
    id: mat.id,
    itemId: mat.itemId || null,
    sku: mat.item?.sku || null,
    descriptionSnapshot: mat.descriptionSnapshot,
    dimensions: mat.dimensions,
    presentation: mat.presentation,
    unit: mat.unit || mat.item?.unitOfMeasure || null,
    quantityPerPiece,
    pieces: perPiece ? factor : null,
    quantity: roundQuantity(quantityPerPiece * factor),
    supplierId: mat.supplierId,
    supplierName: mat.supplier?.name || null,
    unitPrice: includeCost ? Number(mat.unitPrice || 0) : 0,
  };
}

export function mapSelectedMaterials(available = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  return available
    .filter((row) => selected.has(row.id))
    .map((row) => ({
      id: row.id,
      itemId: row.itemId || null,
      descriptionSnapshot: row.descriptionSnapshot || row.description || "",
      quantity: Number(row.quantity) || 0,
      unit: row.unit || null,
      dimensions: row.dimensions || null,
      presentation: row.presentation || null,
      supplierId: row.supplierId || null,
      supplierName: row.supplierName || row.supplier?.name || null,
      unitPrice: Number(row.unitPrice || 0),
      quotedUnitPrice: Number(row.unitPrice || 0),
      sourceType: "QUOTE_MATERIAL",
      sourceMaterialId: row.id,
      needsCatalogMapping: !row.itemId,
    }));
}

/** Partidas sin costo capturado; la OC no puede enviarse ni aprobarse con ellas. */
export function linesWithoutCost(lines = []) {
  return lines.filter((line) => !(Number(line.unitPrice) > 0));
}

export function missingCostMessage(lines = []) {
  const names = linesWithoutCost(lines)
    .map((line) => line.descriptionSnapshot || line.item?.name || "partida")
    .join(", ");
  return names ? `Captura el costo de: ${names}` : null;
}

export function toPurchaseFormLine(row) {
  return {
    itemId: row.itemId || "",
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice) || 0,
    quotedUnitPrice:
      row.quotedUnitPrice != null ? Number(row.quotedUnitPrice) : null,
    unit: row.unit || "",
    descriptionSnapshot: row.descriptionSnapshot || "",
    dimensions: row.dimensions || "",
    presentation: row.presentation || "",
    supplierName: row.supplierName || "",
    sourceMaterialId: row.sourceMaterialId || null,
    manual: !row.itemId,
  };
}

export function toPurchaseItemPayload(line) {
  return {
    itemId: line.itemId || null,
    descriptionSnapshot: line.descriptionSnapshot || null,
    dimensions: line.dimensions || null,
    presentation: line.presentation || null,
    supplierName: line.supplierName || null,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice) || 0,
    unit: line.unit || null,
    sourceType: line.sourceMaterialId ? "QUOTE_MATERIAL" : "MANUAL",
    sourceMaterialId: line.sourceMaterialId || null,
  };
}

export function mergePurchaseLines(current = [], incoming = []) {
  const remaining = current.filter(
    (line) => line.itemId || String(line.descriptionSnapshot || "").trim()
  );
  const existing = new Set(
    remaining.map((line) => line.sourceMaterialId).filter(Boolean)
  );
  const extra = incoming.filter(
    (line) => !line.sourceMaterialId || !existing.has(line.sourceMaterialId)
  );
  return [...remaining, ...extra];
}

export function dedupeBySourceMaterial(lines = []) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const key = line.sourceMaterialId || null;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(line);
  }
  return result;
}
