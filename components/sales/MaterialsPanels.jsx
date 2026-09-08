"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, PackageCheck, Package } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { SkipPurchaseModal } from "@/components/sales/SkipPurchaseModal";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";

const TABS = [
  { key: "pendingPurchase", label: "Pendientes de compra", icon: ShoppingCart },
  { key: "pendingReceipt", label: "Pendientes de recepción", icon: Package },
  { key: "received", label: "Recibidos", icon: PackageCheck },
];

export function MaterialsPanels({ counts, sellerId, onChanged }) {
  const [tab, setTab] = useState("pendingPurchase");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [skipTarget, setSkipTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const path =
        tab === "pendingPurchase"
          ? "/api/ventas/materiales/pendientes-compra"
          : tab === "pendingReceipt"
            ? "/api/ventas/materiales/pendientes-recepcion"
            : "/api/ventas/materiales/recibidos";
      const data = await api.get(path + toQuery({ sellerId: sellerId || undefined }));
      setRows(data?.data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los materiales");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, sellerId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  async function markWillPurchase(row) {
    setSaving(true);
    try {
      await api.post("/api/ventas/materiales/decision", {
        quoteItemMaterialId: row.id,
        willPurchase: true,
      });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la decisión");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSkip({ skipReason, observations }) {
    if (!skipTarget) return;
    setSaving(true);
    try {
      await api.post("/api/ventas/materiales/decision", {
        quoteItemMaterialId: skipTarget.id,
        willPurchase: false,
        skipReason,
        observations,
      });
      setSkipTarget(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la decisión");
    } finally {
      setSaving(false);
    }
  }

  const countFor = (key) => {
    if (key === "pendingPurchase") return counts?.pendingPurchase ?? 0;
    if (key === "pendingReceipt") return counts?.pendingReceipt ?? 0;
    return counts?.received ?? 0;
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-content">
          Materiales y compras de mis proyectos
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-surface-muted text-content-muted hover:bg-brand-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                <Badge tone={active ? "brand" : "neutral"}>{countFor(t.key)}</Badge>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardBody>
        {error && (
          <div className="mb-3">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-muted">
            No hay materiales en esta categoría.
          </p>
        ) : tab === "pendingPurchase" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-content-muted">
                  <th className="px-2 py-2 font-medium">Proyecto</th>
                  <th className="px-2 py-2 font-medium">Cotización</th>
                  <th className="px-2 py-2 font-medium">Partida</th>
                  <th className="px-2 py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">¿Comprar?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2">
                      {r.productionOrderId ? (
                        <Link
                          href={`/produccion/${r.productionOrderId}`}
                          className="text-brand-700 hover:underline"
                        >
                          {r.productionFolio || "OP"}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/cotizaciones/${r.quoteId}`}
                        className="text-brand-700 hover:underline"
                      >
                        {r.quoteFolio}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      #{r.quoteItemPosition} {r.quoteItemDescription}
                    </td>
                    <td className="px-2 py-2">
                      <div>{r.material}</div>
                      {r.dimensions && (
                        <div className="text-xs text-content-muted">{r.dimensions}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {r.quantity} {r.unit}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="subtle"
                          loading={saving}
                          onClick={() => markWillPurchase(r)}
                        >
                          Se comprará
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSkipTarget(r)}
                        >
                          No se comprará
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "pendingReceipt" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-content-muted">
                  <th className="px-2 py-2 font-medium">Proyecto</th>
                  <th className="px-2 py-2 font-medium">OC</th>
                  <th className="px-2 py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">Fecha OC</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2">
                      {r.productionFolio || r.quoteFolio || "-"}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/ordenes-compra/${r.purchaseOrderId}`}
                        className="text-brand-700 hover:underline"
                      >
                        {r.purchaseOrderFolio}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{r.material}</td>
                    <td className="px-2 py-2">{r.quantity}</td>
                    <td className="px-2 py-2">{formatDate(r.requestDate)}</td>
                    <td className="px-2 py-2">
                      <Badge tone="warning">{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-content-muted">
                  <th className="px-2 py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">OC</th>
                  <th className="px-2 py-2 font-medium">Proyecto</th>
                  <th className="px-2 py-2 font-medium">Recepción</th>
                  <th className="px-2 py-2 font-medium">Recibido por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2">{r.material}</td>
                    <td className="px-2 py-2">{r.quantity}</td>
                    <td className="px-2 py-2">{r.purchaseOrderFolio}</td>
                    <td className="px-2 py-2">
                      {r.productionFolio || r.quoteFolio || "-"}
                    </td>
                    <td className="px-2 py-2">
                      <div>{r.receiptFolio}</div>
                      <div className="text-xs text-content-muted">
                        {formatDateTime(r.receivedAt || r.receiptDate)}
                      </div>
                    </td>
                    <td className="px-2 py-2">{r.receivedBy?.name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
      <SkipPurchaseModal
        open={Boolean(skipTarget)}
        onClose={() => setSkipTarget(null)}
        onConfirm={confirmSkip}
        loading={saving}
      />
    </Card>
  );
}

export default MaterialsPanels;
