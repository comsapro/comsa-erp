"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Factory,
  FileText,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import {
  DIRECT_ORDER_STATUS_LABELS,
  DIRECT_ORDER_STATUS_TONES,
  ORDER_TYPE_LABELS,
} from "@/domains/direct-orders/constants";
import DirectOrderForm from "../DirectOrderForm";

export default function DirectOrderDetailClient({ id }) {
  const router = useRouter();
  const { toast } = useToast();
  const { has } = usePermissions();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [reasonModal, setReasonModal] = useState({ open: false, action: null });
  const [reason, setReason] = useState("");
  const [toDelete, setToDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/ordenes-directas/${id}`);
      setRecord(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  const runAction = async (action, body) => {
    setActing(true);
    try {
      const updated = await api.post(
        `/api/ordenes-directas/${id}/acciones/${action}`,
        body
      );
      setRecord(updated);
      toast({ variant: "success", title: "Accion aplicada" });
      setReasonModal({ open: false, action: null });
      setReason("");
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo completar",
        description: err.message,
      });
    } finally {
      setActing(false);
    }
  };

  const onSubmitHeader = async (values) => {
    setSaving(true);
    try {
      const updated = await api.put(`/api/ordenes-directas/${id}`, values);
      setRecord(updated);
      toast({ variant: "success", title: "Orden actualizada" });
      return { ok: true };
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: error.message,
      });
      return { fieldErrors: error.fieldErrors };
    } finally {
      setSaving(false);
    }
  };

  const onSaveItem = async (values) => {
    const updated = await api.post(`/api/ordenes-directas/${id}/items`, values);
    setRecord(updated);
    toast({ variant: "success", title: "Item agregado" });
  };

  const onDeleteItem = async (itemId) => {
    try {
      const updated = await api.del(
        `/api/ordenes-directas/${id}/items/${itemId}`
      );
      setRecord(updated);
      toast({ variant: "success", title: "Item eliminado" });
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err.message,
      });
    }
  };

  const deleteDraft = async () => {
    try {
      await api.del(`/api/ordenes-directas/${id}`);
      toast({ variant: "success", title: "Orden eliminada" });
      router.push("/ordenes-directas");
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err.message,
      });
    } finally {
      setToDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <Alert variant="danger" title="Error">
        {error || "Orden no encontrada"}
      </Alert>
    );
  }

  const isDraft = record.status === "DRAFT";
  const canEdit = isDraft && has("direct_orders.edit");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Orden ${record.folio}`}
        description={`${ORDER_TYPE_LABELS[record.orderType] || record.orderType} · ${record.client?.commercialName || ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={DIRECT_ORDER_STATUS_TONES[record.status] || "neutral"}>
              {DIRECT_ORDER_STATUS_LABELS[record.status] || record.status}
            </Badge>
            <Button as={Link} href="/ordenes-directas" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </div>
        }
      />

      {/* Workflow actions */}
      <Card className="flex flex-wrap gap-2 p-4">
        {isDraft && (
          <>
            <Can permission="direct_orders.submit">
              <Button
                size="sm"
                loading={acting}
                onClick={() => runAction("submit")}
                disabled={!record.items?.length}
              >
                <Send className="h-4 w-4" /> Enviar a aprobacion
              </Button>
            </Can>
            <Can permission="direct_orders.cancel">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setReasonModal({ open: true, action: "cancel" })}
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            </Can>
            <Can permission="direct_orders.delete_draft">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setToDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Eliminar borrador
              </Button>
            </Can>
          </>
        )}

        {record.status === "PENDING_APPROVAL" && (
          <>
            <Can permission="direct_orders.approve">
              <Button size="sm" loading={acting} onClick={() => runAction("approve")}>
                <CheckCircle2 className="h-4 w-4" /> Aprobar
              </Button>
            </Can>
            <Can permission="direct_orders.reject">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setReasonModal({ open: true, action: "reject" })}
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
            </Can>
            <Can permission="direct_orders.edit">
              <Button
                size="sm"
                variant="secondary"
                loading={acting}
                onClick={() => runAction("return")}
              >
                <RotateCcw className="h-4 w-4" /> Devolver a borrador
              </Button>
            </Can>
          </>
        )}

        {record.status === "APPROVED" && (
          <>
            {!record.quote && (
            <Can permission="direct_orders.convert_to_quote">
              <Button
                size="sm"
                variant="secondary"
                loading={acting}
                onClick={() => runAction("convert-to-quote")}
              >
                <FileText className="h-4 w-4" /> Convertir a cotizacion
              </Button>
            </Can>
            )}
            <Can permission="direct_orders.send_to_production">
              <Button
                size="sm"
                loading={acting}
                onClick={() => runAction("send-production")}
              >
                <Factory className="h-4 w-4" /> Enviar a produccion
              </Button>
            </Can>
          </>
        )}

        {record.status === "REJECTED" && (
          <Can permission="direct_orders.edit">
            <Button
              size="sm"
              variant="secondary"
              loading={acting}
              onClick={() => runAction("return")}
            >
              <RotateCcw className="h-4 w-4" /> Devolver a borrador
            </Button>
          </Can>
        )}

        {record.quote && (
          <Button as={Link} href={`/cotizaciones/${record.quote.id}`} size="sm" variant="subtle">
            <FileText className="h-4 w-4" /> Cotizacion {record.quote.folio}
          </Button>
        )}
        {record.productionOrder && (
          <Button
            as={Link}
            href={`/produccion/${record.productionOrder.id}`}
            size="sm"
            variant="subtle"
          >
            Produccion {record.productionOrder.folio}
          </Button>
        )}
      </Card>

      {(record.rejectionReason || record.cancellationReason) && (
        <Alert variant="warning" title="Motivo registrado">
          {record.rejectionReason || record.cancellationReason}
        </Alert>
      )}

      {record.quote && (
        <Card className="p-5">
          <h2 className="mb-1 text-base font-semibold text-content">
            Procesos, materiales y extras
          </h2>
          <p className="mb-4 text-sm text-content-muted">
            Se capturan en la cotizacion {record.quote.folio}, sin horas. Al
            autorizar esta orden pasa a produccion. Produccion registra las horas
            reales y la cotizacion regresa al vendedor, que solo puede agregar
            cargos. No aparece en Cotizaciones hasta que el supervisor la aprueba
            y se puede enviar el PDF.
          </p>
          <Button as={Link} href={`/cotizaciones/${record.quote.id}`} size="sm">
            <FileText className="h-4 w-4" /> Capturar partidas
          </Button>
        </Card>
      )}

      {canEdit ? (
        <DirectOrderForm
          mode="edit"
          initial={record}
          saving={saving}
          onSubmitHeader={onSubmitHeader}
          onSaveItem={onSaveItem}
          onDeleteItem={onDeleteItem}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold">Encabezado</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-content-muted">Cliente</dt>
              <dd>{record.client?.commercialName || "-"}</dd>
              <dt className="text-content-muted">Contacto</dt>
              <dd>{record.clientContact?.name || "-"}</dd>
              <dt className="text-content-muted">Vendedor</dt>
              <dd>{record.seller?.name || "-"}</dd>
              <dt className="text-content-muted">Empresa emisora</dt>
              <dd>{record.issuingCompany?.commercialName || "-"}</dd>
              <dt className="text-content-muted">Solicitud</dt>
              <dd>{formatDate(record.requestDate)}</dd>
              <dt className="text-content-muted">Vigencia</dt>
              <dd>{formatDate(record.validUntil)}</dd>
              <dt className="text-content-muted">Requisicion</dt>
              <dd>{record.requisition || "-"}</dd>
              <dt className="text-content-muted">Observaciones</dt>
              <dd className="col-span-2">{record.observations || "-"}</dd>
              {record.approvedAt && (
                <>
                  <dt className="text-content-muted">Aprobada</dt>
                  <dd>
                    {formatDateTime(record.approvedAt)}
                    {record.approvedByUser
                      ? ` · ${record.approvedByUser.name}`
                      : ""}
                  </dd>
                </>
              )}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold">Items</h2>
            {!record.items?.length ? (
              <p className="text-sm text-content-muted">Sin items.</p>
            ) : (
              <ul className="divide-y divide-border">
                {record.items.map((item) => (
                  <li key={item.id} className="py-2 text-sm">
                    <p className="font-medium text-content">{item.description}</p>
                    <p className="text-content-muted">
                      Cant. {Number(item.quantity)} {item.unit || ""} · Beneficio{" "}
                      {Number(item.benefitPercentage)}%
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={reasonModal.open}
        onClose={() => setReasonModal({ open: false, action: null })}
        title={
          reasonModal.action === "reject"
            ? "Rechazar orden"
            : "Cancelar orden"
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Motivo"
            htmlFor="reason"
            required
            error={
              reason.trim().length > 0 && reason.trim().length < 3
                ? "Minimo 3 caracteres"
                : undefined
            }
          >
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
              onClick={() => setReasonModal({ open: false, action: null })}
            >
              Cerrar
            </Button>
            <Button
              variant={reasonModal.action === "reject" ? "danger" : "primary"}
              loading={acting}
              disabled={reason.trim().length < 3}
              onClick={() =>
                runAction(reasonModal.action, { reason: reason.trim() })
              }
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete}
        onClose={() => setToDelete(false)}
        onConfirm={deleteDraft}
        title="Eliminar borrador"
        description={`Se eliminara la orden ${record.folio}.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
