"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { api, toQuery } from "@/lib/api/client";

export default function PurchaseOrderFormClient({
  productionOrderId = "",
  quoteId = "",
  itemId = "",
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [linkedProductions, setLinkedProductions] = useState([]);
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
      api.get(`/api/cotizaciones${toQuery({ pageSize: 100 })}`),
    ]).then(([sup, it, qt]) => {
      setSuppliers(sup?.data || []);
      setItems(it?.data || []);
      setQuotes(qt?.data || []);
    });
  }, []);

  useEffect(() => {
    if (!qId) {
      setLinkedProductions([]);
      return;
    }
    let cancelled = false;
    api
      .get(`/api/cotizaciones/${qId}`)
      .then((quote) => {
        if (cancelled) return;
        const ops = quote?.productionOrders || [];
        if (quote?.productionOrder && !ops.find((o) => o.id === quote.productionOrder.id)) {
          ops.unshift(quote.productionOrder);
        }
        setLinkedProductions(ops);
        if (productionOrderId) setProdId(productionOrderId);
        else if (ops.length === 1) setProdId(ops[0].id);
      })
      .catch(() => {
        if (!cancelled) setLinkedProductions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [qId, productionOrderId]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name, description: s.rfc || "" })),
    [suppliers]
  );
  const quoteOptions = useMemo(
    () =>
      quotes.map((q) => ({
        value: q.id,
        label: q.folio,
        description: q.client?.commercialName || q.status,
      })),
    [quotes]
  );
  const productionOptions = useMemo(
    () =>
      linkedProductions.map((p) => ({
        value: p.id,
        label: p.folio,
        description: p.materialsReadyAt
          ? `${p.status || ""} · material listo`
          : p.status || "",
      })),
    [linkedProductions]
  );
  const itemOptions = useMemo(
    () =>
      items.map((it) => ({
        value: it.id,
        label: `${it.sku || ""} ${it.name}`.trim(),
        description: it.itemType || "",
      })),
    [items]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!qId) throw new Error("La cotizacion es obligatoria");
      const created = await api.post("/api/ordenes-compra", {
        supplierId,
        productionOrderId: prodId || null,
        quoteId: qId,
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

        <CatalogCombobox
          label="Proveedor"
          value={supplierId}
          onChange={setSupplierId}
          options={supplierOptions}
          required
          placeholder="Buscar proveedor..."
        />

        <CatalogCombobox
          label="Cotizacion"
          value={qId}
          onChange={(v) => {
            setQId(v);
            setProdId("");
          }}
          options={quoteOptions}
          required
          placeholder="Buscar cotizacion..."
        />

        {qId && (
          <div className="rounded-md border border-border bg-surface-muted/40 p-3">
            <p className="mb-2 text-sm font-medium text-content">
              Ordenes de produccion de la cotizacion
            </p>
            {linkedProductions.length === 0 ? (
              <p className="text-sm text-content-muted">
                Sin OP vinculadas. Puedes crear la OC y asociar despues.
              </p>
            ) : (
              <ul className="mb-3 space-y-1 text-sm">
                {linkedProductions.map((op) => (
                  <li key={op.id} className="flex flex-wrap gap-2">
                    <Link
                      href={`/produccion/${op.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {op.folio}
                    </Link>
                    <span className="text-content-muted">
                      {op.status || ""}
                      {op.materialsReadyAt ? " · material listo" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <CatalogCombobox
              label="OP vinculada (opcional)"
              value={prodId}
              onChange={setProdId}
              options={productionOptions}
              allowClear
              clearLabel="Sin OP"
              placeholder="Filtrar OP..."
            />
          </div>
        )}

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

        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">Comentarios</span>
          <textarea
            className="w-full rounded-md border border-border px-3 py-2"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </label>

        <div className="space-y-3">
          <p className="text-sm font-medium">Partidas</p>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <CatalogCombobox
                  label={idx === 0 ? "Item" : undefined}
                  value={line.itemId}
                  onChange={(v) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], itemId: v };
                    setLines(next);
                  }}
                  options={itemOptions}
                  placeholder="Buscar item..."
                />
              </div>
              <label className="block text-sm">
                {idx === 0 && (
                  <span className="mb-1 block text-content-muted">Cant.</span>
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="w-full rounded-md border border-border px-3 py-2"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], quantity: e.target.value };
                    setLines(next);
                  }}
                />
              </label>
              <label className="block text-sm">
                {idx === 0 && (
                  <span className="mb-1 block text-content-muted">P. unit.</span>
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="w-full rounded-md border border-border px-3 py-2"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], unitPrice: e.target.value };
                    setLines(next);
                  }}
                />
              </label>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { itemId: "", quantity: 1, unitPrice: 0, unit: "" },
              ])
            }
          >
            Agregar partida
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" loading={saving}>
            Crear OC
          </Button>
        </div>
      </form>
    </div>
  );
}
