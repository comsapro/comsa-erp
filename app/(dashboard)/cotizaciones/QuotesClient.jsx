"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ThumbsDown,
  XCircle,
} from "lucide-react";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
} from "@/domains/quotes/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { useResourceList } from "@/components/tables/useResourceList";
import { DataTable } from "@/components/tables/DataTable";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Pagination } from "@/components/tables/Pagination";
import { RowActions } from "@/components/tables/RowActions";
import { Button } from "@/components/ui/Button";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ViewModeToggle } from "@/components/views/ViewModeToggle";
import { StatusKanban } from "@/components/views/StatusKanban";
import { MonthCalendar } from "@/components/views/MonthCalendar";
import { useViewMode } from "@/components/views/useViewMode";

const ENDPOINT = "/api/cotizaciones";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  ...QUOTE_STATUSES.map((status) => ({
    value: status,
    label: QUOTE_STATUS_LABELS[status],
  })),
];

const KANBAN_COLUMNS = QUOTE_STATUSES.map((id) => ({
  id,
  label: QUOTE_STATUS_LABELS[id],
  tone:
    id === "APPROVED" || id === "IN_PRODUCTION"
      ? "success"
      : id === "PENDING_APPROVAL"
        ? "warning"
        : id === "REJECTED"
          ? "danger"
          : "neutral",
}));

export default function QuotesClient() {
  const router = useRouter();
  const { has } = usePermissions();
  const { mode, setMode } = useViewMode("quotes:viewMode");
  const list = useResourceList(ENDPOINT, {
    initialSort: "createdAt",
    initialOrder: "desc",
    initialFilters: { status: "" },
    pageSize: mode === "table" ? 10 : 200,
  });

  const activeStatus = list.filters.status ?? "";

  const columns = useMemo(
    () => [
      {
        key: "folio",
        header: "Folio",
        sortable: true,
        sortKey: "folio",
        render: (r) => (
          <Link
            href={`/cotizaciones/${r.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {r.folio}
          </Link>
        ),
      },
      {
        key: "elaborationDate",
        header: "Elaboracion",
        sortable: true,
        sortKey: "elaborationDate",
        render: (r) => formatDate(r.elaborationDate),
      },
      {
        key: "validUntil",
        header: "Vigencia",
        sortable: true,
        sortKey: "validUntil",
        render: (r) => formatDate(r.validUntil),
      },
      {
        key: "client",
        header: "Cliente",
        render: (r) => r.client?.commercialName || "-",
      },
      {
        key: "status",
        header: "Estatus",
        sortable: true,
        sortKey: "status",
        render: (r) => (
          <QuoteStatusBadge
            status={r.status}
            label={QUOTE_STATUS_LABELS[r.status] || r.status}
          />
        ),
      },
      {
        key: "total",
        header: "Total",
        sortable: true,
        sortKey: "total",
        render: (r) => formatMoney(r.total, r.currency || "MXN"),
      },
      {
        key: "seller",
        header: "Vendedor",
        render: (r) => r.seller?.name || "-",
      },
      {
        key: "issuingCompany",
        header: "Empresa emisora",
        render: (r) => r.issuingCompany?.commercialName || "-",
      },
      {
        key: "currency",
        header: "Moneda",
        render: (r) => r.currency || "MXN",
      },
      {
        key: "actions",
        header: "",
        headerClassName: "w-12",
        render: (r) => {
          const isDraft = r.status === "DRAFT";
          const isPending = r.status === "PENDING_APPROVAL";
          const isApproved = r.status === "APPROVED";
          const isRejected = r.status === "REJECTED";

          return (
            <RowActions
              actions={[
                {
                  label: "Ver",
                  icon: Eye,
                  onClick: () => router.push(`/cotizaciones/${r.id}`),
                },
                {
                  label: "Editar",
                  icon: Pencil,
                  onClick: () => router.push(`/cotizaciones/${r.id}`),
                  hidden: !(isDraft && has("quotes.edit")),
                },
                {
                  label: "Enviar",
                  icon: Send,
                  onClick: () =>
                    router.push(`/cotizaciones/${r.id}?action=submit`),
                  hidden: !(isDraft && has("quotes.submit")),
                },
                {
                  label: "Aprobar",
                  icon: CheckCircle2,
                  onClick: () =>
                    router.push(`/cotizaciones/${r.id}?action=approve`),
                  hidden: !(isPending && has("quotes.approve")),
                },
                {
                  label: "Rechazar",
                  icon: ThumbsDown,
                  onClick: () =>
                    router.push(`/cotizaciones/${r.id}?action=reject`),
                  hidden: !(isPending && has("quotes.reject")),
                },
                {
                  label: "Devolver",
                  icon: RotateCcw,
                  onClick: () =>
                    router.push(`/cotizaciones/${r.id}?action=return`),
                  hidden: !(
                    (isPending || isRejected) &&
                    has("quotes.return_to_draft")
                  ),
                },
                {
                  label: "Cancelar",
                  icon: XCircle,
                  danger: true,
                  onClick: () =>
                    router.push(`/cotizaciones/${r.id}?action=cancel`),
                  hidden: !(isDraft && has("quotes.cancel")),
                },
                {
                  label: "Enviar a produccion",
                  icon: FileText,
                  onClick: () =>
                    router.push(
                      `/cotizaciones/${r.id}?action=send-production`
                    ),
                  hidden: !(isApproved && has("quotes.send_to_production")),
                },
              ]}
            />
          );
        },
      },
    ],
    [has, router]
  );

  const kanbanColumns = useMemo(() => {
    if (activeStatus) {
      return KANBAN_COLUMNS.filter((c) => c.id === activeStatus);
    }
    return KANBAN_COLUMNS;
  }, [activeStatus]);

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description="Gestiona cotizaciones, aprobaciones y envio a produccion."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewModeToggle value={mode} onChange={setMode} />
            <Can permission="quotes.create">
              <Button as={Link} href="/cotizaciones/nuevo">
                <Plus className="h-4 w-4" /> Nueva cotizacion
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = activeStatus === tab.value;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => list.setFilter("status", tab.value)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-content-muted hover:text-content"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <TableToolbar
        q={list.q}
        onSearch={list.setQ}
        searchPlaceholder="Buscar por folio, cliente u OC..."
        onRefresh={list.refresh}
        loading={list.loading}
      />

      {mode === "table" && (
        <>
          <DataTable
            columns={columns}
            rows={list.rows}
            loading={list.loading}
            error={list.error}
            sort={list.sort}
            onSort={list.toggleSort}
            emptyTitle="Sin cotizaciones"
            emptyDescription="Aun no hay cotizaciones con estos criterios."
          />
          <Pagination
            pagination={list.pagination}
            onPageChange={list.setPage}
            loading={list.loading}
          />
        </>
      )}

      {mode === "kanban" && (
        <StatusKanban
          columns={kanbanColumns}
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          getStatus={(r) => r.status}
          getHref={(r) => `/cotizaciones/${r.id}`}
          getTitle={(r) => r.folio}
          getSubtitle={(r) => r.client?.commercialName || "Sin cliente"}
          getDate={(r) => r.elaborationDate}
          getTotal={(r) => ({
            amount: r.total,
            currency: r.currency || "MXN",
          })}
          emptyTitle="Sin cotizaciones"
          emptyDescription="Aun no hay cotizaciones con estos criterios."
        />
      )}

      {mode === "calendar" && (
        <MonthCalendar
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          getDate={(r) => r.elaborationDate}
          getHref={(r) => `/cotizaciones/${r.id}`}
          getTitle={(r) => r.folio}
          getSubtitle={(r) =>
            `${r.client?.commercialName || "Sin cliente"} · ${
              QUOTE_STATUS_LABELS[r.status] || r.status
            }`
          }
          emptyTitle="Sin cotizaciones"
          emptyDescription="No hay cotizaciones en este dia."
        />
      )}
    </div>
  );
}
