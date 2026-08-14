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
