"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileDown,
  Library,
  Pencil,
  Plus,
  Power,
  Printer,
  RotateCcw,
  Send,
  ShoppingCart,
  ThumbsDown,
  Trash2,
  XCircle,
} from "lucide-react";
import { QUOTE_STATUS_LABELS, ORDER_TYPE_LABELS, quoteCanPrint } from "@/domains/quotes/constants";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { QuoteVersionsNav } from "@/components/quotes/QuoteVersionsNav";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { RowActions } from "@/components/tables/RowActions";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { formatDate, formatMoney } from "@/lib/utils/format";
import {
  PartidaDetailView,
  partidaLineCounts,
} from "@/components/quotes/PartidaDetailView";
import { QuoteHeaderEdit } from "@/components/quotes/QuoteHeaderEdit";
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
  const [viewItem, setViewItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
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
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [purchaseOrderInput, setPurchaseOrderInput] = useState("");
  const [estimatedDeliveryInput, setEstimatedDeliveryInput] = useState("");

  const openSendToProduction = useCallback(() => {
    setPurchaseOrderInput(quote?.purchaseOrder || "");
    setEstimatedDeliveryInput("");
    setProductionModalOpen(true);
  }, [quote?.purchaseOrder]);

  const canViewCost = has("quotes.view_cost");
  const canViewBenefit = has("quotes.view_benefit");
  const isDraft = quote?.status === "DRAFT";
  const isSellerReview = quote?.status === "SELLER_REVIEW";
  const canEditLines = (isDraft || isSellerReview) && has("quotes.edit");
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

    if (action === "send-production") {
      const canSend =
        ["APPROVED", "IN_PRODUCTION"].includes(quote.status) &&
        has("quotes.send_to_production");
      if (canSend) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setPurchaseOrderInput(quote.purchaseOrder || "");
        setEstimatedDeliveryInput("");
        setProductionModalOpen(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
      clearActionQuery();
      return;
    }

    const allowed = {
      submit:
        (quote.status === "DRAFT" || quote.status === "SELLER_REVIEW") &&
        has("quotes.submit"),
      approve: quote.status === "PENDING_APPROVAL" && has("quotes.approve"),
      return:
        ["PENDING_APPROVAL", "REJECTED"].includes(quote.status) &&
        has("quotes.return_to_draft"),
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
    setSelectedTemplateId("");
    try {
      const res = await api.get(
        `/api/biblioteca-items${toQuery({
          status: "ACTIVE",
          pageSize: 50,
          sort: "name",
          order: "asc",
        })}`
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

  const searchLibrary = async (q) => {
    try {
      const res = await api.get(
        `/api/biblioteca-items${toQuery({
          status: "ACTIVE",
          q: q || undefined,
          pageSize: 50,
          sort: "name",
          order: "asc",
        })}`
      );
      setTemplates(res?.data || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo buscar en biblioteca",
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
      toast({ variant: "success", title: "Partida duplicada" });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo duplicar",
        description: err.message,
      });
    }
  };

  const toggleItemStatus = async (item) => {
    try {
      await api.patch(`/api/cotizaciones/${quoteId}/items/${item.id}`);
      toast({
        variant: "success",
        title:
          item.status === "ACTIVE"
            ? "Partida desactivada"
            : "Partida activada",
      });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo cambiar el estatus",
        description: err.message,
      });
    }
  };

  const saveItemToLibrary = async (item) => {
    try {
      await api.post(
        `/api/cotizaciones/${quoteId}/items/${item.id}/guardar-biblioteca`
      );
      toast({ variant: "success", title: "Partida guardada en biblioteca" });
      await loadQuote();
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar en biblioteca",
        description: err.message,
      });
    }
  };

  const deleteItem = async () => {
    if (!toDeleteItem) return;
    try {
      await api.del(`/api/cotizaciones/${quoteId}/items/${toDeleteItem.id}`);
      toast({ variant: "success", title: "Partida eliminada" });
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
        description={`${quote.priceAfterProduction ? "Orden directa · " : ""}${quote.client?.commercialName || "Sin cliente"} · ${
          ORDER_TYPE_LABELS[quote.orderType] || quote.orderType
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} href="/cotizaciones" variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            {has("quotes.print") && quoteCanPrint(quote) && (
              <>
                <Button
                  as={Link}
                  href={`/cotizaciones/${quoteId}/imprimir`}
                  variant="secondary"
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `/api/cotizaciones/${quoteId}/pdf`,
                        { credentials: "include" }
                      );
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        throw new Error(
                          body.error || body.message || `Error ${res.status}`
                        );
                      }
                      const blob = await res.blob();
                      if (!blob || blob.size === 0) {
                        throw new Error("El PDF vino vacio");
                      }
                      const type = (blob.type || "").toLowerCase();
                      if (type && !type.includes("pdf") && !type.includes("octet-stream")) {
                        const text = await blob.text().catch(() => "");
                        throw new Error(
                          text?.slice(0, 120) || "La respuesta no es un PDF"
                        );
                      }
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${quote.folio || "cotizacion"}.pdf`;
                      a.rel = "noopener";
                      a.style.display = "none";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 4000);
                      toast({
                        variant: "success",
                        title: "PDF descargado",
                      });
                    } catch (err) {
                      toast({
                        variant: "error",
                        title: "PDF no disponible",
                        description: err.message,
                      });
                    }
                  }}
                >
                  <FileDown className="h-4 w-4" /> PDF
                </Button>
              </>
            )}
            {has("quotes.print") && !quoteCanPrint(quote) && (
                <Button
                  variant="secondary"
                  disabled
                  title="Solo disponible cuando la cotizacion esta aprobada"
                >
                  <Printer className="h-4 w-4" /> Imprimir / PDF
                </Button>
              )}
            {(quote.status === "DRAFT" || quote.status === "SELLER_REVIEW") &&
              has("quotes.submit") && (
              <Button
                variant="subtle"
                loading={actionBusy}
                onClick={() => runAction("submit")}
              >
                <Send className="h-4 w-4" />{" "}
                {quote.status === "SELLER_REVIEW" ? "Enviar a aprobacion" : "Enviar"}
              </Button>
            )}
            {quote.status === "PENDING_APPROVAL" && has("quotes.approve") && (
              <Button
                variant="subtle"
                loading={actionBusy}
                onClick={() => runAction("approve")}
              >
                <CheckCircle2 className="h-4 w-4" />{" "}
                {quote.priceAfterProduction && !quote.productionOrderId
                  ? "Autorizar produccion"
                  : "Aprobar"}
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
              !quote.priceAfterProduction &&
              has("quotes.send_to_production") && (
                <Button
                  loading={actionBusy}
                  onClick={openSendToProduction}
                >
                  <Send className="h-4 w-4" /> Enviar a produccion
                </Button>
              )}
            {quote.status === "IN_PRODUCTION" &&
              has("quotes.send_to_production") && (
                <Button
                  variant="subtle"
                  loading={actionBusy}
                  onClick={openSendToProduction}
                >
                  <Send className="h-4 w-4" /> Enviar partidas nuevas
                </Button>
              )}
            {quote.status === "IN_PRODUCTION" &&
              has("purchase_orders.create") && (
                <Button
                  as={Link}
                  href={`/ordenes-compra/nuevo?quoteId=${quote.id}${
                    quote.productionOrderId
                      ? `&productionOrderId=${quote.productionOrderId}`
                      : quote.productionOrder?.id
                        ? `&productionOrderId=${quote.productionOrder.id}`
                        : ""
                  }`}
                  variant="secondary"
                >
                  <ShoppingCart className="h-4 w-4" /> Crear OC
                </Button>
              )}
            {["APPROVED", "IN_PRODUCTION", "CANCELLED"].includes(quote.status) &&
              has("quotes.create") && (
                <Button
                  variant="secondary"
                  loading={actionBusy}
                  onClick={async () => {
                    setActionBusy(true);
                    try {
                      const created = await api.post(
                        `/api/cotizaciones/${quoteId}/acciones/revise`
                      );
                      toast({
                        variant: "success",
                        title: "Nueva version creada",
                        description: created?.folio,
                      });
                      router.push(`/cotizaciones/${created.id}`);
                    } catch (err) {
                      toast({
                        variant: "error",
                        title: "No se pudo versionar",
                        description: err.message,
                      });
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                >
                  <Copy className="h-4 w-4" /> Nueva version
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
          <CardBody>
            <QuoteHeaderEdit
              quote={quote}
              onSaved={(updated) => {
                if (updated?.id) {
                  setQuote((prev) => ({
                    ...prev,
                    ...updated,
                    versions: updated.versions || prev?.versions || [],
                  }));
                } else loadQuote();
              }}
            />
            {(quote.productionOrders || []).length > 0 && (
              <div className="mt-4 border-t border-border pt-4 text-sm">
                <p className="text-content-muted">Ordenes de produccion</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {quote.productionOrders.map((op) => (
                    <span key={op.id} className="inline-flex flex-wrap gap-1">
                      <Link
                        href={`/produccion/${op.id}`}
                        className="rounded-full bg-surface-muted px-2.5 py-1 text-xs hover:bg-brand-50"
                      >
                        {op.folio}
                        {op.materialsReadyAt ? " · material listo" : ""}
                      </Link>
                      <Link
                        href={`/calidad/${op.id}`}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-100"
                      >
                        Calidad
                      </Link>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <QuoteVersionsNav
              currentId={quote.id}
              versions={quote.versions || []}
              parentQuote={quote.parentQuote}
            />
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
          <h2 className="text-sm font-semibold text-content">Partidas</h2>
          {isDraft && has("quotes.edit") && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={openLibrary}>
                <Library className="h-4 w-4" /> Desde biblioteca
              </Button>
              <Button
                size="sm"
                onClick={() => setItemModal({ open: true, record: null })}
              >
                <Plus className="h-4 w-4" /> Agregar partida
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="w-10 px-2 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Descripcion</th>
                <th className="px-4 py-3 font-medium">Cant.</th>
                <th className="px-4 py-3 font-medium">Unidad</th>
                {canViewCost && (
                  <th className="px-4 py-3 font-medium">Costo</th>
                )}
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-content-muted"
                  >
                    Sin partidas. Agrega una o inserta desde la biblioteca.
                  </td>
                </tr>
              ) : (
                quote.items.map((item) => {
                  const expanded = Boolean(expandedItems[item.id]);
                  const counts = partidaLineCounts(item);
                  const lineTotal =
                    counts.manufacturing +
                    counts.materials +
                    counts.extras +
                    counts.installations;
                  const inactive = item.status === "INACTIVE";
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-border last:border-0 ${
                          inactive ? "bg-surface-muted/40 opacity-70" : ""
                        }`}
                      >
                        <td className="px-2 py-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedItems((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-content-muted">
                          {item.position}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-content">
                            {item.description}
                          </p>
                          <p className="mt-0.5 text-xs text-content-muted">
                            {inactive ? "Inactiva · " : ""}
                            {lineTotal > 0
                              ? `${counts.manufacturing} manuf. · ${counts.materials} mat. · ${counts.extras} ext. · ${counts.installations} inst.`
                              : "Sin líneas de costo"}
                            {item.isUrgent ? " · Urgente" : ""}
                          </p>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Ver partida"
                              onClick={() => setViewItem(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEditLines && (
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Editar partida"
                                onClick={() =>
                                  setItemModal({ open: true, record: item })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <RowActions
                              actions={[
                                {
                                  label: inactive
                                    ? "Activar partida"
                                    : "Desactivar partida",
                                  icon: Power,
                                  onClick: () => toggleItemStatus(item),
                                  hidden: !isDraft || !has("quotes.edit"),
                                },
                                {
                                  label: "Guardar en biblioteca",
                                  icon: Library,
                                  onClick: () => saveItemToLibrary(item),
                                  hidden:
                                    !has("quote_templates.create") || !item.id,
                                },
                                {
                                  label: "Duplicar partida",
                                  icon: Copy,
                                  onClick: () => duplicateItem(item),
                                  hidden: !isDraft || !has("quotes.edit"),
                                },
                                {
                                  label: "Eliminar partida",
                                  icon: Trash2,
                                  onClick: () => setToDeleteItem(item),
                                  danger: true,
                                  hidden: !isDraft || !has("quotes.edit"),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-border bg-surface-muted/30">
                          <td colSpan={8} className="px-4 py-4">
                            <PartidaDetailView
                              item={item}
                              currency={currency}
                              canViewCost={canViewCost}
                              canViewBenefit={canViewBenefit}
                              quoteId={quoteId}
                              canEditAttachments={isDraft && has("quotes.edit")}
                              compact
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, record: null })}
        title={itemModal.record ? "Editar partida" : "Nueva partida"}
        size="xl"
      >
        <QuoteItemForm
          key={itemModal.record?.id || "new-item"}
          initial={itemModal.record}
          quoteId={quoteId}
          saving={savingItem}
          currency={currency}
          onSubmit={saveItem}
          onSavedToLibrary={loadQuote}
          captureWithoutHours={Boolean(quote.priceAfterProduction) && isDraft}
          sellerReview={isSellerReview}
          sellerReviewStartedAt={quote.sellerReviewStartedAt}
        />
      </Modal>

      <Modal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title="Detalle de partida"
        size="xl"
      >
        {viewItem && (
          <PartidaDetailView
            item={viewItem}
            currency={currency}
            canViewCost={canViewCost}
            canViewBenefit={canViewBenefit}
            quoteId={quoteId}
            canEditAttachments={isDraft && has("quotes.edit")}
          />
        )}
      </Modal>

      <Modal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Insertar desde biblioteca"
        size="md"
      >
        <div className="space-y-4">
          <CatalogCombobox
            label="Plantilla"
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            options={(templates || []).map((t) => ({
              value: t.id,
              label: t.name,
              description: t.category || undefined,
            }))}
            placeholder="Buscar plantilla..."
            allowClear
            clearLabel="Sin seleccion"
            canCreate={false}
            onSearch={searchLibrary}
          />
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
        open={productionModalOpen}
        onClose={() => {
          if (actionBusy) return;
          setProductionModalOpen(false);
          setPurchaseOrderInput("");
          setEstimatedDeliveryInput("");
        }}
        title="Enviar a produccion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Indica el numero de orden de compra del cliente y la fecha de entrega
            aproximada para registrar el envio a produccion.
          </p>
          <Field
            label="Numero de orden de compra"
            htmlFor="purchase-order-production"
            required
          >
            <Input
              id="purchase-order-production"
              value={purchaseOrderInput}
              onChange={(e) => setPurchaseOrderInput(e.target.value)}
              placeholder="Ej. OC-12345"
              autoFocus
            />
          </Field>
          <Field
            label="Fecha de entrega aproximada"
            htmlFor="estimated-delivery-production"
            required
          >
            <Input
              id="estimated-delivery-production"
              type="date"
              value={estimatedDeliveryInput}
              onChange={(e) => setEstimatedDeliveryInput(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={actionBusy}
              onClick={() => {
                setProductionModalOpen(false);
                setPurchaseOrderInput("");
                setEstimatedDeliveryInput("");
              }}
            >
              Cerrar
            </Button>
            <Button
              loading={actionBusy}
              disabled={
                purchaseOrderInput.trim().length < 1 ||
                !estimatedDeliveryInput
              }
              onClick={async () => {
                const ok = await runAction("send-production", {
                  purchaseOrder: purchaseOrderInput.trim(),
                  estimatedDeliveryDate: estimatedDeliveryInput,
                });
                if (ok) {
                  setProductionModalOpen(false);
                  setPurchaseOrderInput("");
                  setEstimatedDeliveryInput("");
                }
              }}
            >
              Confirmar envio
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
        title="Eliminar partida"
        description={`Se eliminara "${toDeleteItem?.description}".`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
