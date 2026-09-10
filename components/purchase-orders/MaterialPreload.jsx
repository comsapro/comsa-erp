"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import {
  ItemCatalogSelect,
  QuickCreateItemModal,
} from "@/components/forms/catalog-selects";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { mapSelectedMaterials } from "@/domains/purchase-orders/preload";

export function MaterialPreload({
  productionOrderId,
  quoteId,
  catalogItems = [],
  onCatalogItemsChange,
  onSearchItems,
  onApply,
}) {
  const { has } = usePermissions();
  const canCreateItem = has("items.create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applyError, setApplyError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState({});
  const [linkExisting, setLinkExisting] = useState({});
  const [mappedItemId, setMappedItemId] = useState({});
  const [createFor, setCreateFor] = useState(null);

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
        setLinkExisting({});
        setMappedItemId({});
        setApplyError(null);
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

  if (!productionOrderId && !quoteId) return null;

  const materials = payload?.materials || [];

  const apply = () => {
    setApplyError(null);
    const ids = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!ids.length) {
      setApplyError("Selecciona al menos un material.");
      return;
    }
    const mapped = mapSelectedMaterials(materials, ids).map((row) => ({
      ...row,
      itemId: row.itemId || mappedItemId[row.id] || "",
    }));
    const missing = mapped.filter((row) => !row.itemId);
    if (missing.length) {
      const wantsLink = missing.some((row) => linkExisting[row.id]);
      if (wantsLink) {
        setApplyError("Selecciona el item de catalogo a vincular.");
      } else if (canCreateItem) {
        setApplyError(
          "Hay materiales sin item. Crea un item nuevo o marca vincular a uno existente."
        );
      } else {
        setApplyError(
          "Hay materiales sin item de catalogo. Marca vincular y selecciona uno existente."
        );
      }
      return;
    }
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
          {materials.map((mat) => {
            const needsItem = !mat.itemId;
            const resolvedItemId = mat.itemId || mappedItemId[mat.id] || "";
            const wantsLink = Boolean(linkExisting[mat.id]);
            return (
              <li key={mat.id} className="rounded-md border border-border bg-white p-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[mat.id])}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelected((prev) => ({ ...prev, [mat.id]: checked }));
                      if (!checked) {
                        setLinkExisting((prev) => {
                          const next = { ...prev };
                          delete next[mat.id];
                          return next;
                        });
                        setMappedItemId((prev) => {
                          const next = { ...prev };
                          delete next[mat.id];
                          return next;
                        });
                      }
                    }}
                  />
                  <span>
                    <span className="font-medium">{mat.descriptionSnapshot}</span>
                    <span className="block text-xs text-content-muted">
                      {mat.quantity} {mat.unit || ""}
                      {mat.dimensions ? ` · ${mat.dimensions}` : ""}
                      {mat.supplierName ? ` · ${mat.supplierName}` : ""}
                      {needsItem
                        ? resolvedItemId
                          ? " · item listo"
                          : " · sin item de catalogo"
                        : mat.sku
                          ? ` · ${mat.sku}`
                          : ""}
                    </span>
                  </span>
                </label>
                {selected[mat.id] && needsItem && (
                  <div className="mt-2 space-y-2 pl-6">
                    <label className="flex items-start gap-2 text-sm text-content">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={wantsLink}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLinkExisting((prev) => ({
                            ...prev,
                            [mat.id]: checked,
                          }));
                          if (!checked) {
                            setMappedItemId((prev) => {
                              const next = { ...prev };
                              delete next[mat.id];
                              return next;
                            });
                          }
                        }}
                      />
                      <span>Vincular a un item existente del catalogo</span>
                    </label>

                    {wantsLink ? (
                      <ItemCatalogSelect
                        label="Item de catalogo"
                        value={mappedItemId[mat.id] || ""}
                        onChange={(v) =>
                          setMappedItemId((prev) => ({ ...prev, [mat.id]: v }))
                        }
                        options={catalogItems}
                        onOptionsChange={onCatalogItemsChange}
                        onSearch={onSearchItems}
                        placeholder="Buscar item..."
                        allowCreate={false}
                      />
                    ) : (
                      <div className="space-y-2">
                        {resolvedItemId ? (
                          <p className="text-xs text-content-muted">
                            Item nuevo listo para agregar a la OC.
                          </p>
                        ) : canCreateItem ? (
                          <>
                            <p className="text-xs text-content-muted">
                              Sin vincular: crea un item nuevo con los datos del material.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setCreateFor(mat)}
                            >
                              <Plus className="h-4 w-4" />
                              Crear item nuevo
                            </Button>
                          </>
                        ) : (
                          <p className="text-xs text-danger-700">
                            Marca vincular y selecciona un item, o pide permiso para crear
                            items.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {applyError && <p className="mt-2 text-sm text-danger-700">{applyError}</p>}
      {materials.length > 0 && (
        <div className="mt-3">
          <Button type="button" size="sm" variant="secondary" onClick={apply}>
            Agregar seleccion a la OC
          </Button>
        </div>
      )}

      <QuickCreateItemModal
        open={Boolean(createFor)}
        initialName={createFor?.descriptionSnapshot || ""}
        initialUnit={createFor?.unit || ""}
        initialDescription={
          createFor
            ? [
                createFor.descriptionSnapshot,
                createFor.dimensions,
                createFor.presentation,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        initialItemType="RAW_MATERIAL"
        onClose={() => setCreateFor(null)}
        onCreated={(created) => {
          onCatalogItemsChange?.([
            created,
            ...(catalogItems || []).filter((it) => it.id !== created.id),
          ]);
          if (createFor?.id) {
            setMappedItemId((prev) => ({ ...prev, [createFor.id]: created.id }));
            setLinkExisting((prev) => ({ ...prev, [createFor.id]: false }));
          }
          setCreateFor(null);
        }}
      />
    </div>
  );
}

export default MaterialPreload;
