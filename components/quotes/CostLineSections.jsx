"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { PROCESS_UNITS, PROCESS_UNIT_LABELS } from "@/domains/catalogs/schemas";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ProcessCatalogSelect,
  InstallationCatalogSelect,
} from "@/components/forms/catalog-selects";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { formatMoney } from "@/lib/utils/format";

const MATERIAL_UNITS = [
  "PZA",
  "KG",
  "M",
  "M2",
  "M3",
  "LT",
  "ROLLO",
  "CAJA",
  "PAR",
  "JUEGO",
  "SERV",
];

function lineAmount(qty, price) {
  return (Number(qty) || 0) * (Number(price) || 0);
}

function SectionShell({ title, description, onAdd, children }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-content">{title}</p>
          {description && (
            <p className="text-xs text-content-muted">{description}</p>
          )}
        </div>
        {onAdd ? (
          <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        ) : (
          <span />
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SectionTotal({ rows, quantityKey = "quantity", priceKey = "unitPrice" }) {
  const sum = (rows || []).reduce(
    (total, row) => total + lineAmount(row?.[quantityKey], row?.[priceKey]),
    0
  );
  return (
    <p className="border-t border-border pt-2 text-sm font-medium text-content">
      Suma de conceptos: {formatMoney(sum)}{" "}
      <span className="font-normal text-content-muted">antes de IVA</span>
    </p>
  );
}

function withSelectedSupplier(list, selected) {
  const rows = Array.isArray(list) ? [...list] : [];
  if (!selected?.id) return rows;
  if (rows.some((row) => row.id === selected.id)) return rows;
  return [{ id: selected.id, name: selected.name || "Proveedor" }, ...rows];
}

function AmountPreview({ quantity, unitPrice }) {
  return (
    <p className="text-xs text-content-muted">
      Importe: {formatMoney(lineAmount(quantity, unitPrice))}
    </p>
  );
}

function SupplierLineSelect({
  value,
  onChange,
  suppliers,
  onSuppliersChange,
  selectedSupplier = null,
}) {
  const selectedId = selectedSupplier?.id || value || "";
  const selectedName = selectedSupplier?.name || (selectedId ? "Proveedor" : "");
  const selected = selectedId ? { id: selectedId, name: selectedName } : null;
  const [options, setOptions] = useState(() =>
    withSelectedSupplier(suppliers, selected)
  );

  useEffect(() => {
    setOptions(
      withSelectedSupplier(
        suppliers,
        selectedId ? { id: selectedId, name: selectedName } : null
      )
    );
  }, [suppliers, selectedId, selectedName]);

  const handleSearch = async (q) => {
    const res = await api.get(
      `/api/proveedores${toQuery({
        status: "ACTIVE",
        q: q || undefined,
        pageSize: 50,
        sort: "name",
        order: "asc",
      })}`
    );
    const data = withSelectedSupplier(res?.data || [], selected);
    setOptions(data);
    onSuppliersChange?.(data);
  };

  return (
    <CatalogCombobox
      label="Proveedor"
      value={value || ""}
      onChange={onChange}
      options={options.map((s) => ({
        value: s.id,
        label: s.name || s.legalName,
        description: s.rfc || undefined,
      }))}
      placeholder="Buscar proveedor..."
      allowClear
      clearLabel="Sin proveedor"
      canCreate={false}
      onSearch={handleSearch}
    />
  );
}

export function CostLineSections({
  control,
  register,
  setValue,
  errors,
  processes = [],
  installations = [],
  onProcessesChange,
  onInstallationsChange,
  hideProcessQuantity = false,
  sellerReview = false,
}) {
  const manufacturing = useFieldArray({ control, name: "manufacturing" });
  const materials = useFieldArray({ control, name: "materials" });
  const extras = useFieldArray({ control, name: "extras" });
  const installationsArr = useFieldArray({ control, name: "installations" });

  const manufacturingValues = useWatch({ control, name: "manufacturing" }) || [];
  const materialsValues = useWatch({ control, name: "materials" }) || [];
  const extrasValues = useWatch({ control, name: "extras" }) || [];
  const installationsValues = useWatch({ control, name: "installations" }) || [];
  const [suppliers, setSuppliers] = useState([]);

  const mergeSuppliers = (incoming) => {
    setSuppliers((prev) => {
      const map = new Map();
      for (const row of [...(prev || []), ...(incoming || [])]) {
        if (row?.id) map.set(row.id, row);
      }
      return [...map.values()];
    });
  };

  const onSelectProcess = (index, processId, processOverride = null) => {
    const process =
      processOverride || processes.find((p) => p.id === processId) || null;
    setValue(`manufacturing.${index}.manufacturingProcessId`, processId || "");
    if (process) {
      setValue(`manufacturing.${index}.processCode`, process.code || "");
      setValue(`manufacturing.${index}.processStatus`, process.status || "ACTIVE");
      setValue(`manufacturing.${index}.processNameSnapshot`, process.name || "");
      setValue(`manufacturing.${index}.unitSnapshot`, process.unit || "HOUR");
      setValue(
        `manufacturing.${index}.unitRate`,
        process.defaultRate != null ? Number(process.defaultRate) : 0
      );
    }
  };

  const onSelectInstallation = (index, conceptId, conceptOverride = null) => {
    const concept =
      conceptOverride || installations.find((c) => c.id === conceptId) || null;
    setValue(`installations.${index}.installationConceptId`, conceptId || null);
    if (concept) {
      setValue(`installations.${index}.conceptCode`, concept.code || "");
      setValue(`installations.${index}.conceptNameSnapshot`, concept.name || "");
      setValue(`installations.${index}.unitSnapshot`, concept.unit || "SERVICE");
      setValue(
        `installations.${index}.unitPrice`,
        concept.defaultPrice != null ? Number(concept.defaultPrice) : 0
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionShell
        title="Manufactura"
        description={
          hideProcessQuantity
            ? "Selecciona los procesos. Las horas las registra produccion al terminar."
            : "Selecciona un proceso del catalogo. Nombre, unidad y tarifa quedan bloqueados."
        }
        onAdd={() =>
          manufacturing.append({
            manufacturingProcessId: "",
            processNameSnapshot: "",
            unitSnapshot: "HOUR",
            quantity: hideProcessQuantity ? 0 : 1,
            unitRate: 0,
            observations: "",
            sortOrder: manufacturing.fields.length,
          })
        }
      >
        {manufacturing.fields.length === 0 && (
          <p className="text-sm text-content-muted">Sin lineas de manufactura.</p>
        )}
        {manufacturing.fields.map((field, index) => {
          const locked = Boolean(manufacturingValues[index]?.manufacturingProcessId);
          return (
            <div
              key={field.id}
              className="grid gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <ProcessCatalogSelect
                  label="Proceso"
                  value={manufacturingValues[index]?.manufacturingProcessId || ""}
                  selectedOption={
                    manufacturingValues[index]?.manufacturingProcessId ||
                    manufacturingValues[index]?.processNameSnapshot
                      ? {
                          id: manufacturingValues[index]?.manufacturingProcessId || "",
                          code: manufacturingValues[index]?.processCode || "",
                          name:
                            manufacturingValues[index]?.processNameSnapshot ||
                            "Proceso",
                          unit: manufacturingValues[index]?.unitSnapshot || "HOUR",
                          defaultRate: manufacturingValues[index]?.unitRate,
                        }
                      : null
                  }
                  options={processes}
                  onOptionsChange={onProcessesChange}
                  onChange={(processId) => onSelectProcess(index, processId)}
                  onSelected={(process) =>
                    onSelectProcess(index, process.id, process)
                  }
                  error={
                    errors?.manufacturing?.[index]?.manufacturingProcessId
                      ?.message
                  }
                />
                {manufacturingValues[index]?.processStatus === "INACTIVE" && (
                  <p className="mt-1 text-xs text-warning-700">
                    Este proceso esta inactivo en el catalogo.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-content-muted">
                  Nombre
                </label>
                <Input
                  {...register(`manufacturing.${index}.processNameSnapshot`)}
                  readOnly
                  disabled
                  className="bg-surface-muted"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-content-muted">
                  Unidad
                </label>
                <Select
                  {...register(`manufacturing.${index}.unitSnapshot`)}
                  disabled
                  className="bg-surface-muted"
                >
                  {PROCESS_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {PROCESS_UNIT_LABELS[u]}
                    </option>
                  ))}
                </Select>
              </div>
              {hideProcessQuantity ? null : (
                <div className="sm:col-span-2 min-w-[8.5rem]">
                  <label className="mb-1 block text-xs font-medium text-content-muted">
                    Cant.
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    className="min-w-[8.5rem] tabular-nums"
                    readOnly={Boolean(manufacturingValues[index]?.locked)}
                    {...register(`manufacturing.${index}.quantity`)}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-content-muted">
                  Tarifa
                </label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`manufacturing.${index}.unitRate`)}
                    readOnly
                    disabled
                    className="min-w-[8.5rem] bg-surface-muted tabular-nums"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => manufacturing.remove(index)}
                    aria-label="Eliminar linea"
                    disabled={Boolean(manufacturingValues[index]?.locked)}
                    className={manufacturingValues[index]?.locked ? "invisible" : ""}
                  >
                    <Trash2 className="h-4 w-4 text-danger-700" />
                  </Button>
                </div>
                <AmountPreview
                  quantity={manufacturingValues[index]?.quantity}
                  unitPrice={manufacturingValues[index]?.unitRate}
                />
                {!locked && (
                  <p className="mt-1 text-xs text-danger-700">
                    Selecciona un proceso
                  </p>
                )}
              </div>
              <div className="sm:col-span-12">
                <label className="mb-1 block text-xs font-medium text-content-muted">
                  Para qué es este proceso en la pieza
                </label>
                <Input
                  {...register(`manufacturing.${index}.observations`)}
                  placeholder="Comentario del proceso en esta pieza"
                  readOnly={Boolean(manufacturingValues[index]?.locked)}
                />
              </div>
            </div>
          );
        })}
        <SectionTotal
          rows={manufacturingValues}
          priceKey="unitRate"
        />
      </SectionShell>

      <SectionShell
        title="Materiales"
        description="BOM: cantidad, descripcion, dimensiones, presentacion, proveedor, unidad y precio."
        onAdd={
          sellerReview
            ? undefined
            : () =>
                materials.append({
                  itemId: null,
                  supplierId: null,
                  descriptionSnapshot: "",
                  dimensions: "",
                  presentation: "",
                  unit: "PZA",
                  quantity: 1,
                  unitPrice: 0,
                  observations: "",
                })
        }
      >
        {materials.fields.length === 0 && (
          <p className="text-sm text-content-muted">Sin materiales.</p>
        )}
        {materials.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3 min-w-[8.5rem]">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cantidad
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                className="min-w-[8.5rem] tabular-nums"
                {...register(`materials.${index}.quantity`)}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Descripcion
              </label>
              <Input {...register(`materials.${index}.descriptionSnapshot`)} />
              {errors?.materials?.[index]?.descriptionSnapshot && (
                <p className="mt-1 text-xs text-danger-700">
                  {errors.materials[index].descriptionSnapshot.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Dimensiones
              </label>
              <Input {...register(`materials.${index}.dimensions`)} />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Presentacion
              </label>
              <Input {...register(`materials.${index}.presentation`)} />
            </div>
            <div className="sm:col-span-4">
              <SupplierLineSelect
                value={materialsValues[index]?.supplierId}
                selectedSupplier={
                  materialsValues[index]?.supplierId
                    ? {
                        id: materialsValues[index].supplierId,
                        name: materialsValues[index].supplierName,
                      }
                    : null
                }
                onChange={(id) => {
                  const found = suppliers.find((row) => row.id === id);
                  setValue(`materials.${index}.supplierId`, id || null);
                  setValue(
                    `materials.${index}.supplierName`,
                    found?.name || found?.legalName || ""
                  );
                }}
                suppliers={suppliers}
                onSuppliersChange={mergeSuppliers}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Unidad
              </label>
              <Select {...register(`materials.${index}.unit`)}>
                {MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {materialsValues[index]?.unit &&
                  !MATERIAL_UNITS.includes(materialsValues[index].unit) && (
                    <option value={materialsValues[index].unit}>
                      {materialsValues[index].unit}
                    </option>
                  )}
              </Select>
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Precio
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="min-w-[8.5rem] tabular-nums"
                {...register(`materials.${index}.unitPrice`)}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Importe / Accion
              </label>
              <div className="flex items-center gap-1">
                <p className="flex-1 text-sm font-medium">
                  {formatMoney(
                    lineAmount(
                      materialsValues[index]?.quantity,
                      materialsValues[index]?.unitPrice
                    )
                  )}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => materials.remove(index)}
                  aria-label="Eliminar linea"
                  disabled={Boolean(materialsValues[index]?.locked)}
                  className={materialsValues[index]?.locked ? "invisible" : ""}
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <SectionTotal rows={materialsValues} />
      </SectionShell>

      <SectionShell
        title="Extras"
        description="Conceptos adicionales con precio."
        onAdd={() =>
          extras.append({
            description: "",
            quantity: 1,
            unit: "",
            unitPrice: 0,
            supplierId: null,
            supplierName: "",
            observations: "",
          })
        }
      >
        {extras.fields.length === 0 && (
          <p className="text-sm text-content-muted">Sin extras.</p>
        )}
        {extras.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-5">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Descripcion
              </label>
              <Input {...register(`extras.${index}.description`)} />
              {errors?.extras?.[index]?.description && (
                <p className="mt-1 text-xs text-danger-700">
                  {errors.extras[index].description.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Unidad
              </label>
              <Input {...register(`extras.${index}.unit`)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cantidad
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                className="min-w-[8.5rem] tabular-nums"
                {...register(`extras.${index}.quantity`)}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Precio unitario
              </label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="min-w-[8.5rem] tabular-nums"
                  {...register(`extras.${index}.unitPrice`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => extras.remove(index)}
                  aria-label="Eliminar linea"
                  disabled={Boolean(extrasValues[index]?.locked)}
                  className={extrasValues[index]?.locked ? "invisible" : ""}
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
              <AmountPreview
                quantity={extrasValues[index]?.quantity}
                unitPrice={extrasValues[index]?.unitPrice}
              />
            </div>
            <div className="sm:col-span-4">
              <SupplierLineSelect
                value={extrasValues[index]?.supplierId}
                selectedSupplier={
                  extrasValues[index]?.supplierId
                    ? {
                        id: extrasValues[index].supplierId,
                        name: extrasValues[index].supplierName,
                      }
                    : null
                }
                onChange={(id) => {
                  const found = suppliers.find((row) => row.id === id);
                  setValue(`extras.${index}.supplierId`, id || null);
                  setValue(
                    `extras.${index}.supplierName`,
                    found?.name || found?.legalName || ""
                  );
                }}
                suppliers={suppliers}
                onSuppliersChange={mergeSuppliers}
              />
            </div>
          </div>
        ))}
        <SectionTotal rows={extrasValues} />
      </SectionShell>

      <SectionShell
        title="Instalaciones"
        description="Conceptos de instalacion del catalogo."
        onAdd={
          sellerReview
            ? undefined
            : () =>
                installationsArr.append({
                  installationConceptId: null,
                  conceptNameSnapshot: "",
                  unitSnapshot: "SERVICE",
                  quantity: 1,
                  unitPrice: 0,
                  observations: "",
                })
        }
      >
        {installationsArr.fields.length === 0 && (
          <p className="text-sm text-content-muted">Sin instalaciones.</p>
        )}
        {installationsArr.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <InstallationCatalogSelect
                label="Concepto"
                value={
                  installationsValues[index]?.installationConceptId || ""
                }
                selectedOption={
                  installationsValues[index]?.installationConceptId ||
                  installationsValues[index]?.conceptNameSnapshot
                    ? {
                        id: installationsValues[index]?.installationConceptId || "",
                        code: installationsValues[index]?.conceptCode || "",
                        name:
                          installationsValues[index]?.conceptNameSnapshot ||
                          "Concepto",
                        unit: installationsValues[index]?.unitSnapshot || "SERVICE",
                        defaultPrice: installationsValues[index]?.unitPrice,
                      }
                    : null
                }
                options={installations}
                onOptionsChange={onInstallationsChange}
                onChange={(conceptId) =>
                  onSelectInstallation(index, conceptId)
                }
                onSelected={(concept) =>
                  onSelectInstallation(index, concept.id, concept)
                }
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Nombre
              </label>
              <Input
                {...register(`installations.${index}.conceptNameSnapshot`)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Unidad
              </label>
              <Select {...register(`installations.${index}.unitSnapshot`)}>
                {PROCESS_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {PROCESS_UNIT_LABELS[u]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2 min-w-[8.5rem]">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cant.
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                className="min-w-[8.5rem] tabular-nums"
                {...register(`installations.${index}.quantity`)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Precio
              </label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="min-w-[8.5rem] tabular-nums"
                  {...register(`installations.${index}.unitPrice`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => installationsArr.remove(index)}
                  aria-label="Eliminar linea"
                  disabled={Boolean(installationsValues[index]?.locked)}
                  className={installationsValues[index]?.locked ? "invisible" : ""}
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
              <AmountPreview
                quantity={installationsValues[index]?.quantity}
                unitPrice={installationsValues[index]?.unitPrice}
              />
            </div>
          </div>
        ))}
        <SectionTotal rows={installationsValues} />
      </SectionShell>
    </div>
  );
}

export default CostLineSections;
