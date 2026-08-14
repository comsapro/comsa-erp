"use client";

import { useEffect, useMemo, useState } from "react";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { mapSelectedMaterials } from "@/domains/purchase-orders/preload";

export function MaterialPreload({
  productionOrderId,
  quoteId,
  catalogItems = [],
  onApply,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState({});
  const [mappedItemId, setMappedItemId] = useState({});

  useEffect(() => {
    if (!productionOrderId && !quoteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(
        `/api/ordenes-compra/precarga-materiales${toQuery({
          productionOrderId: productionOrderId || undefined,
          quoteId: quoteId || undefined,
        })}`
      )
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        const initial = {};
        for (const mat of data.materials || []) {
          initial[mat.id] = false;
        }
        setSelected(initial);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productionOrderId, quoteId]);

  const itemOptions = useMemo(
    () =>
      catalogItems.map((it) => ({
        value: it.id,
        label: `${it.sku || ""} ${it.name}`.trim(),
        description: it.itemType || "",
      })),
    [catalogItems]
  );

  if (!productionOrderId && !quoteId) return null;

  const materials = payload?.materials || [];

  const apply = () => {
    const ids = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const mapped = mapSelectedMaterials(materials, ids).map((row) => ({
      ...row,
      itemId: row.itemId || mappedItemId[row.id] || "",
    }));
    onApply?.(mapped, payload);
  };

  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3">
      <p className="text-sm font-medium text-content">Precargar materiales</p>
      <p className="mb-3 text-xs text-content-muted">
        Selecciona los materiales de origen. No se copian precios de venta.
      </p>
      {loading && <p className="text-sm text-content-muted">Cargando materiales...</p>}
      {error && <p className="text-sm text-danger-700">{error}</p>}
      {!loading && materials.length === 0 && (
        <p className="text-sm text-content-muted">Sin materiales cotizados para precargar.</p>
      )}
      {materials.length > 0 && (
        <ul className="space-y-2">
          {materials.map((mat) => (
            <li key={mat.id} className="rounded-md border border-border bg-white p-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[mat.id])}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [mat.id]: e.target.checked }))
                  }
                />
                <span>
                  <span className="font-medium">{mat.descriptionSnapshot}</span>
                  <span className="block text-xs text-content-muted">
                    {mat.quantity} {mat.unit || ""}
                    {mat.dimensions ? ` · ${mat.dimensions}` : ""}
                    {mat.supplierName ? ` · ${mat.supplierName}` : ""}
                    {!mat.itemId ? " · requiere item de catalogo" : mat.sku ? ` · ${mat.sku}` : ""}
                  </span>
                </span>
              </label>
              {selected[mat.id] && !mat.itemId && (
                <div className="mt-2">
                  <CatalogCombobox
                    label="Mapear a item de catalogo"
                    value={mappedItemId[mat.id] || ""}
                    onChange={(v) =>
                      setMappedItemId((prev) => ({ ...prev, [mat.id]: v }))
                    }
                    options={itemOptions}
                    placeholder="Buscar item..."
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {materials.length > 0 && (
        <div className="mt-3">
          <Button type="button" size="sm" variant="secondary" onClick={apply}>
            Agregar seleccion a la OC
          </Button>
        </div>
      )}
    </div>
  );
}

export default MaterialPreload;
