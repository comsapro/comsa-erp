export function mapSelectedMaterials(
  available = [],
  selectedIds = [],
  { includeSalePrice = false } = {}
) {
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
      unitPrice: includeSalePrice ? Number(row.unitPrice || 0) : 0,
      sourceType: "QUOTE_MATERIAL",
      sourceMaterialId: row.id,
      needsCatalogMapping: !row.itemId,
    }));
}

export function toPurchaseFormLine(row) {
  return {
    itemId: row.itemId || "",
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice) || 0,
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
