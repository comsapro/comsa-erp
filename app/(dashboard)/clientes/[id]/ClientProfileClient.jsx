"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Can } from "@/components/permissions/Can";
import { useCrudActions } from "@/components/tables/useCrudActions";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils/format";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";
import {
  DIRECT_ORDER_STATUS_LABELS,
} from "@/domains/direct-orders/constants";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_SOURCE_LABELS,
} from "@/domains/production/constants";
import ClientForm from "../ClientForm";

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

export default function ClientProfileClient({ id }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { save, saving } = useCrudActions("/api/clientes", {
    onDone: () => load(),
    labels: { updated: "Cliente actualizado" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/clientes/${id}/historial`);
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
          href="/clientes"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a clientes
        </Link>
        <Alert variant="error">{error || "Cliente no encontrado"}</Alert>
      </div>
    );
  }

  const history = record.history || {};
  const primary =
    record.contacts?.find((c) => c.isPrimary) || record.contacts?.[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a clientes
        </Link>
        <PageHeader
          title={record.commercialName}
          description={[record.legalName, record.rfc].filter(Boolean).join(" · ") || "Perfil de cliente"}
          actions={
            <Can permission="clients.edit">
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </Can>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Datos generales
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Estatus</dt>
              <dd className="mt-0.5">
                <StatusBadge status={record.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">RFC</dt>
              <dd className="mt-0.5 font-medium">{record.rfc || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Teléfono</dt>
              <dd className="mt-0.5">{record.phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Condiciones comerciales</dt>
              <dd className="mt-0.5">
                {record.commercialTerms != null && String(record.commercialTerms).trim() !== ""
                  ? record.commercialTerms
                  : "No aplica"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-muted)]">Dirección</dt>
              <dd className="mt-0.5">{record.address || "-"}</dd>
            </div>
            {primary ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-muted)]">Contacto principal</dt>
                <dd className="mt-0.5">
                  {primary.name}
                  {primary.position ? ` · ${primary.position}` : ""}
                  {primary.phone ? ` · ${primary.phone}` : ""}
                  {primary.email ? ` · ${primary.email}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Contactos
          </h2>
          {record.contacts?.length ? (
            <ul className="flex flex-col gap-3 text-sm">
              {record.contacts.map((c) => (
                <li key={c.id} className="border-b border-[var(--color-border)]/50 pb-2 last:border-0">
                  <div className="flex items-center gap-2 font-medium">
                    {c.name}
                    {c.isPrimary ? <Badge tone="brand">Principal</Badge> : null}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    {[c.position, c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Sin contactos registrados.</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Cotizaciones recientes</h2>
        <HistoryTable
          empty="Sin cotizaciones."
          rows={history.quotes}
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

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Órdenes directas</h2>
        <HistoryTable
          empty="Sin órdenes directas."
          rows={history.directOrders}
          columns={[
            {
              key: "folio",
              header: "Folio",
              render: (r) => (
                <Link className="font-medium text-[var(--color-primary)] hover:underline" href={`/ordenes-directas/${r.id}`}>
                  {r.folio}
                </Link>
              ),
            },
            {
              key: "status",
              header: "Estatus",
              render: (r) => DIRECT_ORDER_STATUS_LABELS[r.status] || r.status,
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
        <h2 className="mb-3 text-base font-semibold">Órdenes de producción</h2>
        <HistoryTable
          empty="Sin órdenes de producción."
          rows={history.productionOrders}
          columns={[
            {
              key: "folio",
              header: "Folio",
              render: (r) => (
                <Link className="font-medium text-[var(--color-primary)] hover:underline" href={`/produccion/${r.id}`}>
                  {r.folio}
                </Link>
              ),
            },
            {
              key: "status",
              header: "Estatus",
              render: (r) => PRODUCTION_STATUS_LABELS[r.status] || r.status,
            },
            {
              key: "source",
              header: "Origen",
              render: (r) => PRODUCTION_SOURCE_LABELS[r.sourceType] || r.sourceType,
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
              key: "date",
              header: "Aprobación",
              render: (r) => formatDate(r.approvalDate),
            },
          ]}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Actividad reciente</h2>
        <HistoryTable
          empty="Sin actividad registrada."
          rows={history.activity}
          columns={[
            {
              key: "when",
              header: "Fecha",
              render: (r) => formatDateTime(r.createdAt),
            },
            {
              key: "action",
              header: "Acción",
              render: (r) => `${r.module} · ${r.action}`,
            },
            {
              key: "user",
              header: "Usuario",
              render: (r) => r.user?.name || r.user?.email || "-",
            },
          ]}
        />
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar cliente"
        size="xl"
      >
        <ClientForm
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
