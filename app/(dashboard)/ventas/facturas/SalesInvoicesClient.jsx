"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invoiceListHref } from "@/domains/sales/invoice-reception";
import { Pencil, Plus } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/Input";
import { Can } from "@/components/permissions/Can";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils/format";

export default function SalesInvoicesClient({ initialPendingOnly = false, sellerId = "" }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingOnly, setPendingOnlyState] = useState(initialPendingOnly);

  const setPendingOnly = (next) => {
    setPendingOnlyState(next);
    router.replace(invoiceListHref({ pendingReception: next, sellerId }), { scroll: false });
  };
  const [receptionModal, setReceptionModal] = useState({
    open: false,
    invoice: null,
  });
  const [receptionDate, setReceptionDate] = useState(toDateInputValue(new Date()));
  const [savingReception, setSavingReception] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `/api/ventas/facturas${toQuery({
          pendingReception: pendingOnly ? "1" : undefined,
          sellerId: sellerId || undefined,
        })}`
      );
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las facturas");
    } finally {
      setLoading(false);
    }
  }, [pendingOnly, sellerId]);

  const sellerName = sellerId
    ? rows.find((r) => r.seller?.id === sellerId)?.seller?.name || "vendedor seleccionado"
    : "";

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const pendingCount = rows.filter((r) => !r.receivedByClient).length;

  async function confirmReception() {
    if (!receptionModal.invoice) return;
    setSavingReception(true);
    try {
      await api.post(
        `/api/ventas/facturas/${receptionModal.invoice.id}/recepcion`,
        {
          receivedByClient: true,
          receptionDate,
        }
      );
      setReceptionModal({ open: false, invoice: null });
      await load();
    } catch (err) {
      setError(err.message || "No se pudo marcar la recepción");
    } finally {
      setSavingReception(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas de ventas"
        description="Registro de facturas que alimentan la meta del equipo."
        actions={
          <Button as={Link} href="/ventas/facturas/nuevo">
            <Plus className="h-4 w-4" />
            Nueva factura
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!pendingOnly ? "primary" : "secondary"}
          onClick={() => setPendingOnly(false)}
        >
          Todas
        </Button>
        <Button
          size="sm"
          variant={pendingOnly ? "primary" : "secondary"}
          onClick={() => setPendingOnly(true)}
        >
          Sin recepción del cliente
          {!pendingOnly && pendingCount > 0 ? (
            <Badge tone="warning" className="ml-2">
              {pendingCount}
            </Badge>
          ) : null}
        </Button>
        {sellerId ? (
          <span className="inline-flex items-center gap-2 text-sm text-content-muted">
            Solo facturas de {sellerName}
            <Link
              href={invoiceListHref({ pendingReception: pendingOnly })}
              className="text-brand-700 hover:underline"
            >
              Ver todos los vendedores
            </Link>
          </span>
        ) : null}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-muted">
              {pendingOnly
                ? "No hay facturas pendientes de recepción."
                : "No hay facturas registradas."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2 font-medium">Factura</th>
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Monto (c/IVA)</th>
                    <th className="px-2 py-2 font-medium">Vendedor</th>
                    <th className="px-2 py-2 font-medium">PO cliente</th>
                    <th className="px-2 py-2 font-medium">Cotizaciones</th>
                    <th className="px-2 py-2 font-medium">Archivos</th>
                    <th className="px-2 py-2 font-medium">Recepción</th>
                    <th className="px-2 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-medium">{r.invoiceNumber}</td>
                      <td className="px-2 py-2">{formatDate(r.invoiceDate)}</td>
                      <td className="px-2 py-2">{formatMoney(r.netAmount)}</td>
                      <td className="px-2 py-2">{r.seller?.name}</td>
                      <td className="px-2 py-2">{r.clientPoNumber}</td>
                      <td className="px-2 py-2">
                        {(r.quotes || []).length
                          ? (r.quotes || [])
                              .map((q) => q.quote?.folio)
                              .filter(Boolean)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <span className="flex flex-wrap gap-2">
                          {r.pdfPathname ? (
                            <a
                              className="text-brand-700 underline"
                              href={`/api/blob?pathname=${encodeURIComponent(r.pdfPathname)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              PDF
                            </a>
                          ) : null}
                          {r.xmlPathname ? (
                            <a
                              className="text-brand-700 underline"
                              href={`/api/blob?pathname=${encodeURIComponent(r.xmlPathname)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              XML
                            </a>
                          ) : null}
                          {!r.pdfPathname && !r.xmlPathname ? "—" : null}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {r.receivedByClient ? (
                          <Badge tone="success">
                            Sí · {formatDate(r.receptionDate)}
                          </Badge>
                        ) : (
                          <Badge tone="warning">No</Badge>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Can permission="sales.edit_invoice">
                            <Button
                              as={Link}
                              href={`/ventas/facturas/${r.id}`}
                              size="sm"
                              variant="subtle"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          </Can>
                          {!r.receivedByClient ? (
                            <Can permission="sales.edit_invoice">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setReceptionDate(toDateInputValue(new Date()));
                                  setReceptionModal({ open: true, invoice: r });
                                }}
                              >
                                Marcar recepción
                              </Button>
                            </Can>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={receptionModal.open}
        onClose={() =>
          savingReception
            ? undefined
            : setReceptionModal({ open: false, invoice: null })
        }
        title="Recepción del cliente"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-content-muted">
            Factura {receptionModal.invoice?.invoiceNumber}. Indica la fecha en
            que el cliente recibió la factura.
          </p>
          <Field label="Fecha de recepción" htmlFor="reception-date" required>
            <Input
              id="reception-date"
              type="date"
              value={receptionDate || ""}
              onChange={(e) => setReceptionDate(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={savingReception}
              onClick={() => setReceptionModal({ open: false, invoice: null })}
            >
              Cancelar
            </Button>
            <Button
              loading={savingReception}
              disabled={!receptionDate}
              onClick={confirmReception}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
