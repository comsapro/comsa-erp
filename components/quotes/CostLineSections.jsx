"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { PROCESS_UNITS, PROCESS_UNIT_LABELS } from "@/domains/catalogs/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ProcessCatalogSelect,
  InstallationCatalogSelect,
} from "@/components/forms/catalog-selects";
import { formatMoney } from "@/lib/utils/format";

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
        <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function AmountPreview({ quantity, unitPrice }) {
  return (
    <p className="text-xs text-content-muted">
      Importe: {formatMoney(lineAmount(quantity, unitPrice))}
    </p>
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
}) {
  const manufacturing = useFieldArray({ control, name: "manufacturing" });
  const materials = useFieldArray({ control, name: "materials" });
  const extras = useFieldArray({ control, name: "extras" });
  const installationsArr = useFieldArray({ control, name: "installations" });

  const manufacturingValues = useWatch({ control, name: "manufacturing" }) || [];
  const materialsValues = useWatch({ control, name: "materials" }) || [];
  const extrasValues = useWatch({ control, name: "extras" }) || [];
  const installationsValues = useWatch({ control, name: "installations" }) || [];

  const onSelectProcess = (index, processId, processOverride = null) => {
    const process =
      processOverride || processes.find((p) => p.id === processId) || null;
    setValue(`manufacturing.${index}.manufacturingProcessId`, processId || null);
    if (process) {
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
        description="Procesos con tarifa. Al elegir un proceso se copian nombre, unidad y tarifa."
        onAdd={() =>
          manufacturing.append({
            manufacturingProcessId: null,
            processNameSnapshot: "",
            unitSnapshot: "HOUR",
            quantity: 1,
            unitRate: 0,
            observations: "",
            sortOrder: manufacturing.fields.length,
          })
        }
      >
        {manufacturing.fields.length === 0 && (
          <p className="text-sm text-content-muted">Sin lineas de manufactura.</p>
        )}
        {manufacturing.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <ProcessCatalogSelect
                label="Proceso"
                value={manufacturingValues[index]?.manufacturingProcessId || ""}
                options={processes}
                onOptionsChange={onProcessesChange}
                onChange={(processId) => onSelectProcess(index, processId)}
                onSelected={(process) => onSelectProcess(index, process.id, process)}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Nombre
              </label>
              <Input {...register(`manufacturing.${index}.processNameSnapshot`)} />
              {errors?.manufacturing?.[index]?.processNameSnapshot && (
                <p className="mt-1 text-xs text-danger-700">
                  {errors.manufacturing[index].processNameSnapshot.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Unidad
              </label>
              <Select {...register(`manufacturing.${index}.unitSnapshot`)}>
                {PROCESS_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {PROCESS_UNIT_LABELS[u]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cant.
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register(`manufacturing.${index}.quantity`)}
              />
            </div>
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
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => manufacturing.remove(index)}
                  aria-label="Eliminar linea"
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
              <AmountPreview
                quantity={manufacturingValues[index]?.quantity}
                unitPrice={manufacturingValues[index]?.unitRate}
              />
            </div>
          </div>
        ))}
      </SectionShell>

      <SectionShell
        title="Materiales"
        description="Descripcion, cantidad y precio unitario."
        onAdd={() =>
          materials.append({
            itemId: null,
            supplierId: null,
            descriptionSnapshot: "",
            dimensions: "",
            presentation: "",
            unit: "",
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
            <div className="sm:col-span-5">
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Unidad
              </label>
              <Input {...register(`materials.${index}.unit`)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cantidad
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register(`materials.${index}.quantity`)}
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
                  {...register(`materials.${index}.unitPrice`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => materials.remove(index)}
                  aria-label="Eliminar linea"
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
              <AmountPreview
                quantity={materialsValues[index]?.quantity}
                unitPrice={materialsValues[index]?.unitPrice}
              />
            </div>
          </div>
        ))}
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
                  {...register(`extras.${index}.unitPrice`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => extras.remove(index)}
                  aria-label="Eliminar linea"
                >
                  <Trash2 className="h-4 w-4 text-danger-700" />
                </Button>
              </div>
              <AmountPreview
                quantity={extrasValues[index]?.quantity}
                unitPrice={extrasValues[index]?.unitPrice}
              />
            </div>
          </div>
        ))}
      </SectionShell>

      <SectionShell
        title="Instalaciones"
        description="Conceptos de instalacion. Al elegir del catalogo se copian nombre, unidad y tarifa."
        onAdd={() =>
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
                value={installationsValues[index]?.installationConceptId || ""}
                options={installations}
                onOptionsChange={onInstallationsChange}
                onChange={(conceptId) => onSelectInstallation(index, conceptId)}
                onSelected={(concept) =>
                  onSelectInstallation(index, concept.id, concept)
                }
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Nombre
              </label>
              <Input {...register(`installations.${index}.conceptNameSnapshot`)} />
              {errors?.installations?.[index]?.conceptNameSnapshot && (
                <p className="mt-1 text-xs text-danger-700">
                  {errors.installations[index].conceptNameSnapshot.message}
                </p>
              )}
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
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-content-muted">
                Cant.
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
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
                  {...register(`installations.${index}.unitPrice`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => installationsArr.remove(index)}
                  aria-label="Eliminar linea"
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
      </SectionShell>
    </div>
  );
}

export default CostLineSections;
