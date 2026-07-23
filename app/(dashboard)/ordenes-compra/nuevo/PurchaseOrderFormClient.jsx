"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { api, toQuery } from "@/lib/api/client";

export default function PurchaseOrderFormClient({
  productionOrderId = "",
  quoteId = "",
  itemId = "",
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [productions, setProductions] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [prodId, setProdId] = useState(productionOrderId);
  const [qId, setQId] = useState(quoteId);
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [comments, setComments] = useState("");
  const [lines, setLines] = useState([
    { itemId: itemId || "", quantity: 1, unitPrice: 0, unit: "" },
  ]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/proveedores${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      api.get(`/api/items${toQuery({ status: "ACTIVE", pageSize: 100 })}`),
      api.get(`/api/produccion${toQuery({ pageSize: 50 })}`),
      api.get(`/api/cotizaciones${toQuery({ pageSize: 50 })}`),
    ]).then(([sup, it, prod, qt]) => {
      setSuppliers(sup?.data || []);
      setItems(it?.data || []);
      setProductions(prod?.data || []);
      setQuotes(qt?.data || []);
    });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.post("/api/ordenes-compra", {
        supplierId,
        productionOrderId: prodId || null,
        quoteId: qId || null,
        requestDate,
        expectedDate: expectedDate || null,
        comments,
        items: lines
          .filter((l) => l.itemId)
          .map((l) => ({
            itemId: l.itemId,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            unit: l.unit || null,
          })),
      });
      router.push(`/ordenes-compra/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nueva orden de compra" />
      <form
        onSubmit={onSubmit}
        className="mt-4 space-y-4 rounded-lg border border-border bg-white p-5"
      >
        {error && <p className="text-sm text-danger-700">{error}</p>}
        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">Proveedor</span>
          <select
            className="w-full rounded-md border border-border px-3 py-2"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">Selecciona...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Fecha solicitud</span>
            <input
              type="date"
              className="w-full rounded-md border border-border px-3 py-2"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Fecha esperada</span>
            <input
              type="date"
              className="w-full rounded-md border border-border px-3 py-2"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">
              Orden de produccion (opcional)
            </span>
            <select
              className="w-full rounded-md border border-border px-3 py-2"
              value={prodId}
              onChange={(e) => setProdId(e.target.value)}
            >
              <option value="">Sin relacion</option>
              {productions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.folio}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">
              Cotizacion (opcional)
            </span>
            <select
              className="w-full rounded-md border border-border px-3 py-2"
              value={qId}
              onChange={(e) => setQId(e.target.value)}
            >
              <option value="">Sin relacion</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.folio}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">Comentarios</span>
          <textarea
            className="w-full rounded-md border border-border px-3 py-2"
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium">Partidas</p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap gap-2">
              <select
                className="min-w-[200px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                value={line.itemId}
                onChange={(e) => {
                  const next = [...lines];
                  const selected = items.find((i) => i.id === e.target.value);
                  next[idx] = {
                    ...line,
                    itemId: e.target.value,
                    unit: selected?.unitOfMeasure || "",
                  };
                  setLines(next);
                }}
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
                className="w-24 rounded-md border border-border px-2 py-2 text-sm"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
                placeholder="Cant"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-28 rounded-md border border-border px-2 py-2 text-sm"
                value={line.unitPrice}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, unitPrice: e.target.value };
                  setLines(next);
                }}
                placeholder="Precio"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setLines([...lines, { itemId: "", quantity: 1, unitPrice: 0 }])
            }
          >
            Agregar partida
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
