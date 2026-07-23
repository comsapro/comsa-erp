"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { api, toQuery } from "@/lib/api/client";

export default function TransferFormClient() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [sourceWarehouseId, setSource] = useState("");
  const [destinationWarehouseId, setDest] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ itemId: "", quantity: 1 }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/almacenes${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      api.get(`/api/items${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
    ]).then(([wh, it]) => {
      setWarehouses(wh?.data || []);
      setItems(it?.data || []);
    });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.post("/api/transferencias", {
        sourceWarehouseId,
        destinationWarehouseId,
        notes,
        items: lines.filter((l) => l.itemId && Number(l.quantity) > 0),
      });
      router.push(`/transferencias/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nueva transferencia" />
      <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-lg border border-border bg-white p-5">
        {error && <p className="text-sm text-danger-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Origen</span>
            <select
              className="w-full rounded-md border border-border px-3 py-2"
              value={sourceWarehouseId}
              onChange={(e) => setSource(e.target.value)}
              required
            >
              <option value="">Selecciona...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Destino</span>
            <select
              className="w-full rounded-md border border-border px-3 py-2"
              value={destinationWarehouseId}
              onChange={(e) => setDest(e.target.value)}
              required
            >
              <option value="">Selecciona...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">Notas</span>
          <textarea
            className="w-full rounded-md border border-border px-3 py-2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium">Items</p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap gap-2">
              <select
                className="min-w-[220px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                value={line.itemId}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, itemId: e.target.value };
                  setLines(next);
                }}
                required
              >
                <option value="">Item...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.001"
                step="0.001"
                className="w-28 rounded-md border border-border px-3 py-2 text-sm"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
                required
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines([...lines, { itemId: "", quantity: 1 }])}
          >
            Agregar linea
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar borrador
          </Button>
        </div>
      </form>
    </div>
  );
}
