"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Pencil } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Can } from "@/components/permissions/Can";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import { formatDate, formatMoney } from "@/lib/utils/format";
import {
  supplierCreateSchema,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
} from "@/domains/catalogs/schemas";
import { STATUS_FORM_OPTIONS } from "@/lib/constants/ui";
import { PO_STATUS_LABELS } from "@/domains/purchase-orders/constants";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";

function HistoryTable({ columns, rows, empty }) {
  if (!rows?.length) {
    return <p className="text-sm text-[var(--color-muted)]">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--color-border)]/60 last:border-0"
            >
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-2 align-middle">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierEditForm({ initial, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierCreateSchema),
    defaultValues: {
      name: initial?.name || "",
      legalName: initial?.legalName || "",
      rfc: initial?.rfc || "",
      contactName: initial?.contactName || "",
      phone: initial?.phone || "",
      email: initial?.email || "",
      address: initial?.address || "",
      supplierType: initial?.supplierType || "",
      productsServices: initial?.productsServices || "",
      status: initial?.status || "ACTIVE",
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field, { message: messages[0] });
      }
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <TextField label="Razon social" name="legalName" register={register} error={errors.legalName?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="RFC" name="rfc" register={register} error={errors.rfc?.message} />
        <SelectField label="Tipo de proveedor" name="supplierType" register={register} error={errors.supplierType?.message}>
          <option value="">Sin especificar</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Contacto" name="contactName" register={register} error={errors.contactName?.message} />
        <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
      </div>
      <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} />
      <TextField label="Direccion" name="address" register={register} error={errors.address?.message} />
      <TextareaField label="Productos / servicios" name="productsServices" register={register} error={errors.productsServices?.message} />
      <SelectField label="Estatus" name="status" register={register} error={errors.status?.message}>
        {STATUS_FORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

export default function SupplierProfileClient({ id }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { save, saving } = useCrudActions("/api/proveedores", {
    onDone: () => load(),
    labels: { updated: "Proveedor actualizado" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/proveedores/${id}/historial`);
      setRecord(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a proveedores
        </Link>
        <Alert variant="error">{error || "Proveedor no encontrado"}</Alert>
      </div>
    );
  }

  const history = record.history || {};

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/proveedores"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a proveedores
        </Link>
        <PageHeader
          title={record.name}
          description={[record.legalName, record.rfc].filter(Boolean).join(" · ") || "Perfil de proveedor"}
          actions={
            <Can permission="suppliers.edit">
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </Can>
          }
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Datos generales
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-[var(--color-muted)]">Estatus</dt>
            <dd className="mt-0.5">
              <StatusBadge status={record.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Tipo</dt>
            <dd className="mt-0.5 font-medium">
              {record.supplierType
                ? SUPPLIER_TYPE_LABELS[record.supplierType] || record.supplierType
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">RFC</dt>
            <dd className="mt-0.5 font-medium">{record.rfc || "-"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Contacto</dt>
            <dd className="mt-0.5">{record.contactName || "-"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Teléfono</dt>
            <dd className="mt-0.5">{record.phone || "-"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Correo</dt>
            <dd className="mt-0.5">{record.email || "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-muted)]">Dirección</dt>
            <dd className="mt-0.5">{record.address || "-"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-[var(--color-muted)]">Productos / servicios</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{record.productsServices || "-"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Órdenes de compra</h2>
        <HistoryTable
          empty="Sin órdenes de compra."
          rows={history.purchaseOrders}
          columns={[
            {
              key: "folio",
              header: "Folio",
              render: (r) => (
                <Link className="font-medium text-[var(--color-primary)] hover:underline" href={`/ordenes-compra/${r.id}`}>
                  {r.folio}
                </Link>
              ),
            },
            {
              key: "status",
              header: "Estatus",
              render: (r) => PO_STATUS_LABELS[r.status] || r.status,
            },
            {
              key: "total",
              header: "Total",
              render: (r) => formatMoney(r.total),
            },
            {
              key: "quote",
              header: "Cotización",
              render: (r) =>
                r.quote ? (
                  <Link className="hover:underline" href={`/cotizaciones/${r.quote.id}`}>
                    {r.quote.folio}
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              key: "prod",
              header: "Producción",
              render: (r) =>
                r.productionOrder ? (
                  <Link className="hover:underline" href={`/produccion/${r.productionOrder.id}`}>
                    {r.productionOrder.folio}
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              key: "date",
              header: "Solicitud",
              render: (r) => formatDate(r.requestDate),
            },
          ]}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Recepciones</h2>
        <HistoryTable
          empty="Sin recepciones."
          rows={history.receipts}
          columns={[
            {
              key: "folio",
              header: "Folio",
              render: (r) => (
                <Link className="font-medium text-[var(--color-primary)] hover:underline" href={`/recepciones/${r.id}`}>
                  {r.folio}
                </Link>
              ),
            },
            {
              key: "po",
              header: "OC",
              render: (r) =>
                r.purchaseOrder ? (
                  <Link className="hover:underline" href={`/ordenes-compra/${r.purchaseOrder.id}`}>
                    {r.purchaseOrder.folio}
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              key: "wh",
              header: "Almacén",
              render: (r) => r.warehouse?.name || r.warehouse?.code || "-",
            },
            {
              key: "date",
              header: "Fecha",
              render: (r) => formatDate(r.receiptDate),
            },
          ]}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Cotizaciones vinculadas</h2>
        <HistoryTable
          empty="Sin cotizaciones vinculadas."
          rows={history.linkedQuotes}
          columns={[
            {
              key: "folio",
              header: "Folio",
              render: (r) => (
                <Link className="font-medium text-[var(--color-primary)] hover:underline" href={`/cotizaciones/${r.id}`}>
                  {r.folio}
                </Link>
              ),
            },
            {
              key: "client",
              header: "Cliente",
              render: (r) => r.client?.commercialName || "-",
            },
            {
              key: "status",
              header: "Estatus",
              render: (r) => QUOTE_STATUS_LABELS[r.status] || r.status,
            },
            {
              key: "total",
              header: "Total",
              render: (r) => formatMoney(r.total, r.currency || "MXN"),
            },
            {
              key: "date",
              header: "Fecha",
              render: (r) => formatDate(r.elaborationDate || r.createdAt),
            },
          ]}
        />
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar proveedor"
        size="lg"
      >
        <SupplierEditForm
          initial={record}
          saving={saving}
          onSubmit={async (values) => {
            const result = await save(values, id);
            if (result?.ok) setEditOpen(false);
            return result;
          }}
        />
      </Modal>
    </div>
  );
}
