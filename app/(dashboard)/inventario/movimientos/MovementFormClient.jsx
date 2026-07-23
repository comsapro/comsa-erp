"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  TextField,
  TextareaField,
  SelectField,
} from "@/components/forms/fields";
import { api, toQuery } from "@/lib/api/client";
import {
  entrySchema,
  exitSchema,
  adjustSchema,
} from "@/domains/inventory/schemas";

const CONFIG = {
  entrada: {
    title: "Entrada de inventario",
    endpoint: "/api/inventario/entradas",
    schema: entrySchema,
  },
  salida: {
    title: "Salida de inventario",
    endpoint: "/api/inventario/salidas",
    schema: exitSchema,
  },
  ajuste: {
    title: "Ajuste de inventario",
    endpoint: "/api/inventario/ajustes",
    schema: adjustSchema,
  },
};

export default function MovementFormClient({ mode }) {
  const cfg = CONFIG[mode];
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [productions, setProductions] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(cfg.schema),
    defaultValues: {
      warehouseId: "",
      itemId: "",
      quantity: 1,
      unitCost: undefined,
      notes: "",
      reason: "",
      direction: "IN",
      productionOrderId: "",
    },
  });

  useEffect(() => {
    Promise.all([
      api.get(`/api/almacenes${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      api.get(`/api/items${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      mode === "salida"
        ? api.get(`/api/produccion${toQuery({ pageSize: 50 })}`)
        : Promise.resolve({ data: [] }),
    ])
      .then(([wh, it, prod]) => {
        setWarehouses(wh?.data || []);
        setItems(it?.data || []);
        setProductions(prod?.data || []);
      })
      .catch((err) => setError(err.message));
  }, [mode]);

  async function onSubmit(values) {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...values };
      if (!payload.productionOrderId) delete payload.productionOrderId;
      if (payload.unitCost === "" || payload.unitCost == null) {
        delete payload.unitCost;
      }
      await api.post(cfg.endpoint, payload);
      router.push("/inventario/movimientos");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={cfg.title}
        description="El movimiento actualiza el stock de forma atomica."
      />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 space-y-4 rounded-lg border border-border bg-white p-5"
      >
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}
        <SelectField
          label="Almacen"
          name="warehouseId"
          register={register}
          error={formState.errors.warehouseId?.message}
          required
        >
          <option value="">Selecciona...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Item"
          name="itemId"
          register={register}
          error={formState.errors.itemId?.message}
          required
        >
          <option value="">Selecciona...</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sku} — {it.name}
            </option>
          ))}
        </SelectField>
        {mode === "ajuste" && (
          <SelectField label="Direccion" name="direction" register={register}>
            <option value="IN">Entrada (suma)</option>
            <option value="OUT">Salida (resta)</option>
          </SelectField>
        )}
        <TextField
          label="Cantidad"
          name="quantity"
          type="number"
          step="0.001"
          register={register}
          error={formState.errors.quantity?.message}
          required
        />
        {mode === "entrada" && (
          <TextField
            label="Costo unitario (opcional)"
            name="unitCost"
            type="number"
            step="0.01"
            register={register}
          />
        )}
        {mode === "salida" && (
          <SelectField
            label="Orden de produccion (opcional)"
            name="productionOrderId"
            register={register}
          >
            <option value="">Sin relacion</option>
            {productions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.folio}
              </option>
            ))}
          </SelectField>
        )}
        {mode === "ajuste" && (
          <TextField
            label="Motivo"
            name="reason"
            register={register}
            error={formState.errors.reason?.message}
            required
          />
        )}
        <TextareaField label="Notas" name="notes" register={register} rows={3} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Registrar
          </Button>
        </div>
      </form>
    </div>
  );
}
