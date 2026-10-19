"use client";

import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { CostHint } from "@/components/purchase-orders/CostHint";
import { formatMoney } from "@/lib/utils/format";
import {
  linesWithoutCost,
  toPurchaseFormLine,
  toPurchaseItemPayload,
} from "@/domains/purchase-orders/preload";
import { calculatePurchaseLineTotals } from "@/domains/purchase-orders/calculations";

const inputClass =
  "w-full rounded-md border border-border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none";

/**
 * Edicion de proveedor y partidas de una OC existente.
 * requireCosts: en pendientes de aprobacion no se permite guardar partidas sin costo.
 */
export function PurchaseOrderEditor({ order, requireCosts = false, onSave, onCancel }) {
  const [supplierId, setSupplierId] = useState(order.supplierId);
  const [selectedSupplier, setSelectedSupplier] = useState(order.supplier || null);
  const [searchResults, setSearchResults] = useState([]);
  const [applySupplierToLines, setApplySupplierToLines] = useState(true);
  const [lines, setLines] = useState(() =>
    (order.items || []).map((it) => ({
      ...toPurchaseFormLine({ ...it, unitPrice: Number(it.unitPrice) }),
      quantity: Number(it.quantity),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const searchSuppliers = useCallback(async (q) => {
    const res = await api.get(
      `/api/proveedores${toQuery({
        status: "ACTIVE",
        q: q || undefined,
        pageSize: 50,
        sort: "name",
        order: "asc",
      })}`
    );
    setSearchResults(res?.data || []);
  }, []);

  const supplierOptions = useMemo(() => {
    const rows =
      selectedSupplier && !searchResults.some((s) => s.id === selectedSupplier.id)
        ? [selectedSupplier, ...searchResults]
        : searchResults;
    return rows.map((s) => ({ value: s.id, label: s.name, description: s.rfc || "" }));
  }, [searchResults, selectedSupplier]);

  const chooseSupplier = (id) => {
    setSupplierId(id);
    setSelectedSupplier(searchResults.find((s) => s.id === id) || selectedSupplier);
  };
  const supplierChanged = supplierId !== order.supplierId;

  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          const t = calculatePurchaseLineTotals(line.quantity, line.unitPrice);
          return { subtotal: acc.subtotal + t.subtotal, total: acc.total + t.total };
        },
        { subtotal: 0, total: 0 }
      ),
    [lines]
  );

  const updateLine = (idx, patch) =>
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));

  async function save() {
    setError(null);
    if (!supplierId) return setError("Selecciona el proveedor.");
    if (!lines.length) return setError("La orden debe tener al menos una partida.");
    if (lines.some((line) => !(Number(line.quantity) > 0))) {
      return setError("Todas las cantidades deben ser mayores a cero.");
    }
    if (requireCosts && linesWithoutCost(lines).length) {
      return setError("Captura el costo de todas las partidas.");
    }
    const items = lines.map((line) =>
      toPurchaseItemPayload(
        supplierChanged && applySupplierToLines && selectedSupplier
          ? { ...line, supplierName: selectedSupplier.name }
          : line
      )
    );
    setSaving(true);
    try {
      await onSave({ supplierId, items });
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-content">Modificar orden de compra</h2>
        <p className="text-sm text-content-muted">
          Corrige el proveedor, las cantidades o los costos. El cambio queda en bitacora.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CatalogCombobox
          label="Proveedor"
          value={supplierId}
          onChange={chooseSupplier}
          options={supplierOptions}
          required
          allowClear={false}
          placeholder="Buscar proveedor..."
          onSearch={searchSuppliers}
        />
        {supplierChanged ? (
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-content">
            <input
              type="checkbox"
              checked={applySupplierToLines}
              onChange={(e) => setApplySupplierToLines(e.target.checked)}
            />
            Usar este proveedor en todas las partidas
          </label>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-content-muted">
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="w-24 py-2 pr-2 font-medium">Cant.</th>
              <th className="w-40 py-2 pr-2 font-medium">Costo unitario</th>
              <th className="py-2 pr-2 font-medium">Proveedor del material</th>
              <th className="w-28 py-2 pr-2 text-right font-medium">Total</th>
              <th className="w-10 py-2" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.sourceMaterialId || `${idx}-${line.descriptionSnapshot}`} className="border-b border-border align-top">
                <td className="py-2 pr-2">
                  <p className="font-medium text-content">{line.descriptionSnapshot}</p>
                  <p className="text-xs text-content-muted">
                    {[line.unit, line.dimensions, line.presentation].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Cantidad de ${line.descriptionSnapshot}`}
                    className={inputClass}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Costo unitario de ${line.descriptionSnapshot}`}
                    className={inputClass}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                  <CostHint unitPrice={line.unitPrice} quotedUnitPrice={line.quotedUnitPrice} />
                </td>
                <td className="py-2 pr-2">
                  <input
                    aria-label={`Proveedor de ${line.descriptionSnapshot}`}
                    className={inputClass}
                    value={
                      supplierChanged && applySupplierToLines && selectedSupplier
                        ? selectedSupplier.name
                        : line.supplierName || ""
                    }
                    disabled={supplierChanged && applySupplierToLines}
                    onChange={(e) => updateLine(idx, { supplierName: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2 text-right">
                  {formatMoney(calculatePurchaseLineTotals(line.quantity, line.unitPrice).total)}
                </td>
                <td className="py-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Quitar ${line.descriptionSnapshot}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-muted">
          Subtotal {formatMoney(totals.subtotal)} · Total con IVA{" "}
          <span className="font-medium text-content">{formatMoney(totals.total)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Button loading={saving} onClick={save}>
            Guardar cambios
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

export default PurchaseOrderEditor;
