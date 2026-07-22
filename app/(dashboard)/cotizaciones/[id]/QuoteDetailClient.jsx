"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Library,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  ThumbsDown,
  Trash2,
  XCircle,
} from "lucide-react";
import { QUOTE_STATUS_LABELS, ORDER_TYPE_LABELS } from "@/domains/quotes/constants";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { formatDate, formatMoney } from "@/lib/utils/format";
import QuoteItemForm from "./QuoteItemForm";

export default function QuoteDetailClient({ quoteId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { has } = usePermissions();
  const { toast } = useToast();
  const handledActionRef = useRef(null);

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [itemModal, setItemModal] = useState({ open: false, record: null });
  const [savingItem, setSavingItem] = useState(false);
  const [toDeleteItem, setToDeleteItem] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [inserting, setInserting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reasonModal, setReasonModal] = useState({
    open: false,
    action: null,
    title: "",
  });
  const [reason, setReason] = useState("");

  const canViewCost = has("quotes.view_cost");
  const canViewBenefit = has("quotes.view_benefit");
  const isDraft = quote?.status === "DRAFT";
  const currency = quote?.currency || "MXN";

  const loadQuote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/cotizaciones/${quoteId}`);
      setQuote(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la cotizacion.");
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadQuote();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadQuote]);

  const clearActionQuery = useCallback(() => {
    router.replace(`/cotizaciones/${quoteId}`);
  }, [quoteId, router]);

  const runAction = useCallback(
    async (action, body) => {
      setActionBusy(true);
      try {
        await api.post(`/api/cotizaciones/${quoteId}/acciones/${action}`, body);
        toast({ variant: "success", title: "Accion aplicada" });
        clearActionQuery();
        await loadQuote();
        return true;
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo completar",
          description: err.message,
        });
        clearActionQuery();
        return false;
      } finally {
        setActionBusy(false);
      }
    },
    [quoteId, toast, clearActionQuery, loadQuote]
  );

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action || !quote || loading || actionBusy) return;
    if (handledActionRef.current === `${quoteId}:${action}`) return;
    handledActionRef.current = `${quoteId}:${action}`;

    if (action === "reject" || action === "cancel") {
      /* eslint-disable react-hooks/set-state-in-effect */
      setReasonModal({
        open: true,
        action,
        title: action === "reject" ? "Rechazar cotizacion" : "Cancelar cotizacion",
      });
      /* eslint-enable react-hooks/set-state-in-effect */
      clearActionQuery();
      return;
    }

    const allowed = {
      submit: quote.status === "DRAFT" && has("quotes.submit"),
      approve: quote.status === "PENDING_APPROVAL" && has("quotes.approve"),
      return:
        ["PENDING_APPROVAL", "REJECTED"].includes(quote.status) &&
        has("quotes.return_to_draft"),
      "send-production":
        quote.status === "APPROVED" && has("quotes.send_to_production"),
    };

    if (allowed[action]) {
      runAction(action);
    } else {
      clearActionQuery();
    }
  }, [
    searchParams,
    quote,
    loading,
    actionBusy,
    has,
    quoteId,
    clearActionQuery,
    runAction,
  ]);

  const openLibrary = async () => {
    setLibraryOpen(true);
    try {
      const res = await api.get(
        `/api/biblioteca-items${toQuery({ status: "ACTIVE", pageSize: 100 })}`
      );
      setTemplates(res?.data || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo cargar la biblioteca",
        description: err.message,
      });
    }
  };

  const insertTemplate = async () => {
    if (!selectedTemplateId) return;
    setInserting(true);
    try {
      await api.post(`/api/cotizaciones/${quoteId}/acciones/insert-template`, {
        templateId: selectedTemplateId,
      });
      setLibraryOpen(false);
      setSelectedTemplateId("");
      toast({ variant: "success", title: "Plantilla insertada" });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo insertar",
        description: err.message,
      });
    } finally {
      setInserting(false);
    }
  };

  const saveItem = async (values) => {
    setSavingItem(true);
    try {
      await api.post(`/api/cotizaciones/${quoteId}/items`, values);
      toast({
        variant: "success",
        title: values.id ? "Item actualizado" : "Item agregado",
      });
      setItemModal({ open: false, record: null });
      await loadQuote();
      return { ok: true };
    } catch (err) {
      if (err.status === 422 && err.fieldErrors) {
        return { ok: false, fieldErrors: err.fieldErrors };
      }
      toast({
        variant: "error",
        title: "No se pudo guardar el item",
        description: err.message,
      });
      return { ok: false };
    } finally {
      setSavingItem(false);
    }
  };

  const duplicateItem = async (item) => {
    try {
      await api.post(`/api/cotizaciones/${quoteId}/items/${item.id}/duplicate`);
      toast({ variant: "success", title: "Item duplicado" });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo duplicar",
        description: err.message,
      });
    }
  };

  const deleteItem = async () => {
    if (!toDeleteItem) return;
    try {
      await api.del(`/api/cotizaciones/${quoteId}/items/${toDeleteItem.id}`);
      toast({ variant: "success", title: "Item eliminado" });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <Alert variant="danger" title="Error">
        {error || "Cotizacion no encontrada"}
      </Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title={quote.folio}
        description={`${quote.client?.commercialName || "Sin cliente"} · ${
          ORDER_TYPE_LABELS[quote.orderType] || quote.orderType
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} href="/cotizaciones" variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            {quote.status === "DRAFT" && has("quotes.submit") && (
              <Button
                variant="subtle"
                loading={actionBusy}
                onClick={() => runAction("submit")}
              >
                <Send className="h-4 w-4" /> Enviar
              </Button>
            )}
            {quote.status === "PENDING_APPROVAL" && has("quotes.approve") && (
              <Button
                variant="subtle"
                loading={actionBusy}
                onClick={() => runAction("approve")}
              >
                <CheckCircle2 className="h-4 w-4" /> Aprobar
              </Button>
            )}
            {quote.status === "PENDING_APPROVAL" && has("quotes.reject") && (
              <Button
                variant="secondary"
                onClick={() =>
                  setReasonModal({
                    open: true,
                    action: "reject",
                    title: "Rechazar cotizacion",
                  })
                }
              >
                <ThumbsDown className="h-4 w-4" /> Rechazar
              </Button>
            )}
            {["PENDING_APPROVAL", "REJECTED"].includes(quote.status) &&
              has("quotes.return_to_draft") && (
                <Button
                  variant="secondary"
                  loading={actionBusy}
                  onClick={() => runAction("return")}
                >
                  <RotateCcw className="h-4 w-4" /> Devolver
                </Button>
              )}
            {quote.status === "DRAFT" && has("quotes.cancel") && (
              <Button
                variant="danger"
                onClick={() =>
                  setReasonModal({
                    open: true,
                    action: "cancel",
                    title: "Cancelar cotizacion",
                  })
                }
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            )}
            {quote.status === "APPROVED" &&
              has("quotes.send_to_production") && (
                <Button
                  loading={actionBusy}
                  onClick={() => runAction("send-production")}
                >
                  <Send className="h-4 w-4" /> Enviar a produccion
                </Button>
              )}
            {has("quotes.print") && (
              <Button
                as={Link}
                href={`/cotizaciones/${quote.id}/imprimir`}
                variant="secondary"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <QuoteStatusBadge
          status={quote.status}
          label={QUOTE_STATUS_LABELS[quote.status] || quote.status}
        />
        {quote.rejectionReason && (
          <Alert variant="warning" title="Motivo de rechazo">
            {quote.rejectionReason}
          </Alert>
        )}
        {quote.cancellationReason && (
          <Alert variant="danger" title="Motivo de cancelacion">
            {quote.cancellationReason}
          </Alert>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-content">
              Informacion general
            </h2>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-content-muted">Cliente</dt>
                <dd className="font-medium">
                  {quote.client?.commercialName || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-content-muted">Contacto</dt>
                <dd>{quote.clientContact?.name || "-"}</dd>
              </div>
              <div>
                <dt className="text-content-muted">Empresa emisora</dt>
                <dd>{quote.issuingCompany?.commercialName || "-"}</dd>
              </div>
              <div>
                <dt className="text-content-muted">Vendedor</dt>
                <dd>{quote.seller?.name || "-"}</dd>
              </div>
              <div>
                <dt className="text-content-muted">Elaboracion</dt>
                <dd>{formatDate(quote.elaborationDate)}</dd>
              </div>
              <div>
                <dt className="text-content-muted">Vigencia</dt>
                <dd>{formatDate(quote.validUntil)}</dd>
              </div>
              <div>
                <dt className="text-content-muted">Moneda</dt>
                <dd>{quote.currency}</dd>
              </div>
              <div>
                <dt className="text-content-muted">OC / Requisicion</dt>
                <dd>
                  {quote.purchaseOrder || "-"} / {quote.requisition || "-"}
                </dd>
              </div>
              {quote.paymentNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-content-muted">Notas de pago</dt>
                  <dd className="whitespace-pre-wrap">{quote.paymentNotes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-content">Totales</h2>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              {canViewCost && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-muted">Costo</dt>
                    <dd>{formatMoney(quote.costTotal, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-muted">Manufactura</dt>
                    <dd>{formatMoney(quote.manufacturingTotal, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-muted">Materiales</dt>
                    <dd>{formatMoney(quote.materialsTotal, currency)}</dd>
                  </div>
                </>
              )}
              {canViewBenefit && (
                <div className="flex justify-between gap-3">
                  <dt className="text-content-muted">Subtotal</dt>
                  <dd>{formatMoney(quote.subtotal, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-content-muted">Descuento</dt>
                <dd>{formatMoney(quote.discountTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-muted">IVA</dt>
                <dd>{formatMoney(quote.taxTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(quote.total, currency)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-content">Items</h2>
          {isDraft && has("quotes.edit") && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={openLibrary}>
                <Library className="h-4 w-4" /> Desde biblioteca
              </Button>
              <Button
                size="sm"
                onClick={() => setItemModal({ open: true, record: null })}
              >
                <Plus className="h-4 w-4" /> Agregar item
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Descripcion</th>
                <th className="px-4 py-3 font-medium">Cant.</th>
                <th className="px-4 py-3 font-medium">Unidad</th>
                {canViewCost && (
                  <th className="px-4 py-3 font-medium">Costo</th>
                )}
                <th className="px-4 py-3 font-medium">Total</th>
                {isDraft && has("quotes.edit") && (
                  <th className="px-4 py-3 font-medium" />
                )}
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-content-muted"
                  >
                    Sin items. Agrega uno o inserta desde la biblioteca.
                  </td>
                </tr>
              ) : (
                quote.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-content-muted">
                      {item.position}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-content">
                        {item.description}
                      </p>
                      {item.isUrgent && (
                        <span className="text-xs text-warning-700">Urgente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{Number(item.quantity)}</td>
                    <td className="px-4 py-3">{item.unit || "-"}</td>
                    {canViewCost && (
                      <td className="px-4 py-3">
                        {formatMoney(item.costTotal, currency)}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(item.total, currency)}
                    </td>
                    {isDraft && has("quotes.edit") && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Editar item"
                            onClick={() =>
                              setItemModal({ open: true, record: item })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Duplicar item"
                            onClick={() => duplicateItem(item)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Eliminar item"
                            onClick={() => setToDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4 text-danger-700" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, record: null })}
        title={itemModal.record ? "Editar item" : "Nuevo item"}
        size="xl"
      >
        <QuoteItemForm
          key={itemModal.record?.id || "new-item"}
          initial={itemModal.record}
          saving={savingItem}
          currency={currency}
          onSubmit={saveItem}
        />
      </Modal>

      <Modal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Insertar desde biblioteca"
        size="md"
      >
        <div className="space-y-4">
          <Field label="Plantilla" htmlFor="templateId">
            <Select
              id="templateId"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">Selecciona una plantilla</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.category ? ` (${t.category})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLibraryOpen(false)}>
              Cerrar
            </Button>
            <Button
              loading={inserting}
              disabled={!selectedTemplateId}
              onClick={insertTemplate}
            >
              Insertar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reasonModal.open}
        onClose={() => {
          setReasonModal({ open: false, action: null, title: "" });
          setReason("");
        }}
        title={reasonModal.title}
        size="sm"
      >
        <div className="space-y-4">
          <Field label="Motivo" htmlFor="reason" required>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setReasonModal({ open: false, action: null, title: "" });
                setReason("");
              }}
            >
              Cerrar
            </Button>
            <Button
              variant={reasonModal.action === "cancel" ? "danger" : "primary"}
              loading={actionBusy}
              disabled={reason.trim().length < 3}
              onClick={async () => {
                const ok = await runAction(reasonModal.action, {
                  reason: reason.trim(),
                });
                if (ok) {
                  setReasonModal({ open: false, action: null, title: "" });
                  setReason("");
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteItem}
        onClose={() => setToDeleteItem(null)}
        onConfirm={deleteItem}
        title="Eliminar item"
        description={`Se eliminara "${toDeleteItem?.description}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
