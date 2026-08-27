"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { api, toQuery } from "@/lib/api/client";
import { MaterialPreload } from "@/components/purchase-orders/MaterialPreload";

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
  const [sourceBanner, setSourceBanner] = useState(null);
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
    setSuppliers(res?.data || []);
  }, []);

  const searchItems = useCallback(async (q) => {
    const res = await api.get(
      `/api/items${toQuery({
        status: "ACTIVE",
        q: q || undefined,
        pageSize: 50,
        sort: "name",
        order: "asc",
      })}`
    );
    setItems(res?.data || []);
  }, []);

  const searchQuotes = useCallback(async (q) => {
    const res = await api.get(
      `/api/cotizaciones${toQuery({
        q: q || undefined,
        pageSize: 50,
        sort: "folio",
        order: "desc",
      })}`
    );
    setQuotes(res?.data || []);
  }, []);

  useEffect(() => {
    Promise.all([searchSuppliers(""), searchItems(""), searchQuotes("")]).catch(
      () => {}
    );
  }, [searchSuppliers, searchItems, searchQuotes]);

  useEffect(() => {
    if (!productionOrderId || quoteId) return;
    api
      .get(`/api/produccion/${productionOrderId}`)
      .then((op) => {
        if (op?.quote?.id) setQId(op.quote.id);
        setSourceBanner({
          productionFolio: op?.folio,
          quoteFolio: op?.quote?.folio,
        });
      })
      .catch(() => {});
  }, [productionOrderId, quoteId]);

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
        const ops = (quote?.productionOrders || []).filter((o) => o?.id);
        if (
          quote?.productionOrder &&
          !ops.find((o) => o.id === quote.productionOrder.id)
        ) {
          ops.unshift(quote.productionOrder);
        }
        // Solo OPs ligadas a cotizacion (todas las de esta lista ya lo estan).
        setLinkedProductions(ops);
        if (productionOrderId) setProdId(productionOrderId);
        else if (ops.length === 1) setProdId(ops[0].id);
        setSourceBanner((prev) => ({
          productionFolio: prev?.productionFolio,
          quoteFolio: quote?.folio || prev?.quoteFolio,
        }));
      })
      .catch(() => {
        if (!cancelled) setLinkedProductions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [qId, productionOrderId]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.name,
        description: s.rfc || "",
      })),
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
      if (!prodId) {
        throw new Error("La orden de produccion es obligatoria");
      }
      const created = await api.post("/api/ordenes-compra", {
        supplierId,
        productionOrderId: prodId,
        quoteId: qId,
        requestDate,
        expectedDate: expectedDate || null,
        comments,
        items: lines
          .filter((l) => l.itemId)
          .map((l) => ({
            itemId: l.itemId,
            descriptionSnapshot: l.descriptionSnapshot || null,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            unit: l.unit || null,
            sourceType: l.sourceMaterialId ? "QUOTE_MATERIAL" : "MANUAL",
            sourceMaterialId: l.sourceMaterialId || null,
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

        {(prodId || qId) && (
          <div className="rounded-md border border-border bg-surface-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">Origen de la orden de compra</p>
            <p className="text-content-muted">
              {sourceBanner?.productionFolio || prodId
                ? `Produccion ${sourceBanner?.productionFolio || prodId}`
                : "Selecciona una OP"}
              {sourceBanner?.quoteFolio || qId
                ? ` · Cotizacion ${sourceBanner?.quoteFolio || qId}`
                : ""}
            </p>
          </div>
        )}

        <CatalogCombobox
          label="Proveedor"
          value={supplierId}
          onChange={setSupplierId}
          options={supplierOptions}
          required
          placeholder="Buscar proveedor..."
          onSearch={searchSuppliers}
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
          onSearch={searchQuotes}
        />

        {qId && (
          <div className="rounded-md border border-border bg-surface-muted/40 p-3">
            <p className="mb-2 text-sm font-medium text-content">
              Ordenes de produccion de la cotizacion
            </p>
            {linkedProductions.length === 0 ? (
              <p className="text-sm text-content-muted">
                Sin OP vinculadas a esta cotizacion. Debes tener una OP antes de
                crear la OC.
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
              label="OP vinculada"
              value={prodId}
              onChange={setProdId}
              options={productionOptions}
              required
              placeholder="Seleccionar OP..."
              hint="Obligatoria: la OC debe ligarse a un folio de produccion"
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

        <MaterialPreload
          productionOrderId={prodId}
          quoteId={qId}
          catalogItems={items}
          onApply={(mapped, meta) => {
            if (meta?.quoteId) setQId(meta.quoteId);
            if (meta?.productionOrderId) setProdId(meta.productionOrderId);
            if (meta) {
              setSourceBanner({
                productionFolio: meta.productionFolio,
                quoteFolio: meta.quoteFolio,
              });
            }
            const next = mapped
              .filter((row) => row.itemId)
              .map((row) => ({
                itemId: row.itemId,
                quantity: row.quantity,
                unitPrice: 0,
                unit: row.unit || "",
                descriptionSnapshot: row.descriptionSnapshot,
                sourceMaterialId: row.sourceMaterialId,
              }));
            if (!next.length) return;
            setLines((prev) => {
              const remaining = prev.filter((l) => l.itemId);
              const existingSources = new Set(
                remaining.map((l) => l.sourceMaterialId).filter(Boolean)
              );
              const extra = next.filter(
                (n) =>
                  !n.sourceMaterialId ||
                  !existingSources.has(n.sourceMaterialId)
              );
              return extra.length
                ? [...remaining, ...extra]
                : remaining.length
                  ? remaining
                  : prev;
            });
          }}
        />

        <div className="space-y-3">
          <p className="text-sm font-medium">Partidas</p>
          <p className="text-xs text-content-muted">
            Puedes precargar materiales de la cotizacion o agregar items del
            catalogo que no hayan sido cotizados.
          </p>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <CatalogCombobox
                  label={idx === 0 ? "Item" : undefined}
                  value={line.itemId}
                  onChange={(v) => {
                    const next = [...lines];
                    next[idx] = {
                      ...next[idx],
                      itemId: v,
                      sourceMaterialId: null,
                    };
                    setLines(next);
                  }}
                  options={itemOptions}
                  placeholder="Buscar item..."
                  onSearch={searchItems}
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
