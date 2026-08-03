"use client";

import { formatMoney } from "@/lib/utils/format";
import { PROCESS_UNIT_LABELS } from "@/domains/catalogs/schemas";
import { PartidaAttachments } from "@/components/quotes/PartidaAttachments";

function countLabel(n, singular, plural) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

function MiniTable({ columns, rows, empty }) {
  if (!rows?.length) {
    return <p className="text-xs text-content-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-border">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-surface-muted/60 text-content-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-2.5 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-t border-border">
              {columns.map((c) => (
                <td key={c.key} className="px-2.5 py-2 align-top text-content">
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

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-content-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * Vista de solo lectura del detalle de una partida (item de cotización).
 */
export function PartidaDetailView({
  item,
  currency = "MXN",
  canViewCost = false,
  canViewBenefit = false,
  compact = false,
  quoteId = null,
  canEditAttachments = false,
}) {
  if (!item) return null;

  const manufacturing = item.manufacturing || [];
  const materials = item.materials || [];
  const extras = item.extras || [];
  const installations = item.installations || [];
  const attachments = item.attachments || [];

  const deliveryParts = [
    item.deliveryTimeMin != null || item.deliveryTimeMax != null
      ? [
          item.deliveryTimeMin != null ? item.deliveryTimeMin : "?",
          item.deliveryTimeMax != null ? item.deliveryTimeMax : "?",
        ].join("–")
      : null,
    item.deliveryTimeUnit || null,
    item.deliveryDaysType || null,
  ].filter(Boolean);

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact && (
        <div>
          <p className="text-base font-semibold text-content">{item.description}</p>
          <p className="mt-1 text-sm text-content-muted">
            Cant. {Number(item.quantity)} {item.unit || ""}
            {item.isUrgent ? " · Urgente" : ""}
            {deliveryParts.length ? ` · Entrega: ${deliveryParts.join(" ")}` : ""}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-content-muted">
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {countLabel(manufacturing.length, "manufactura", "manufacturas")}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {countLabel(materials.length, "material", "materiales")}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {countLabel(extras.length, "extra", "extras")}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {countLabel(installations.length, "instalación", "instalaciones")}
        </span>
      </div>

      <Section title="Manufactura">
        <MiniTable
          empty="Sin líneas de manufactura."
          rows={manufacturing}
          columns={[
            {
              key: "name",
              header: "Proceso",
              render: (r) => r.processNameSnapshot || "-",
            },
            {
              key: "qty",
              header: "Cant.",
              render: (r) => Number(r.quantity),
            },
            {
              key: "unit",
              header: "Unidad",
              render: (r) =>
                PROCESS_UNIT_LABELS[r.unitSnapshot] || r.unitSnapshot || "-",
            },
            ...(canViewCost
              ? [
                  {
                    key: "rate",
                    header: "Tarifa",
                    render: (r) => formatMoney(r.unitRate, currency),
                  },
                  {
                    key: "amount",
                    header: "Importe",
                    render: (r) => formatMoney(r.amount, currency),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <Section title="Materiales">
        <MiniTable
          empty="Sin materiales."
          rows={materials}
          columns={[
            {
              key: "desc",
              header: "Descripción",
              render: (r) => (
                <div>
                  <p>{r.descriptionSnapshot || "-"}</p>
                  {(r.dimensions || r.presentation) && (
                    <p className="text-content-muted">
                      {[r.dimensions, r.presentation].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {r.supplier?.name && (
                    <p className="text-content-muted">Prov: {r.supplier.name}</p>
                  )}
                </div>
              ),
            },
            {
              key: "qty",
              header: "Cant.",
              render: (r) => `${Number(r.quantity)}${r.unit ? ` ${r.unit}` : ""}`,
            },
            ...(canViewCost
              ? [
                  {
                    key: "price",
                    header: "P. unit.",
                    render: (r) => formatMoney(r.unitPrice, currency),
                  },
                  {
                    key: "amount",
                    header: "Importe",
                    render: (r) => formatMoney(r.amount, currency),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <Section title="Extras">
        <MiniTable
          empty="Sin extras."
          rows={extras}
          columns={[
            {
              key: "desc",
              header: "Descripción",
              render: (r) => r.description || "-",
            },
            {
              key: "qty",
              header: "Cant.",
              render: (r) => `${Number(r.quantity)}${r.unit ? ` ${r.unit}` : ""}`,
            },
            ...(canViewCost
              ? [
                  {
                    key: "price",
                    header: "P. unit.",
                    render: (r) => formatMoney(r.unitPrice, currency),
                  },
                  {
                    key: "amount",
                    header: "Importe",
                    render: (r) => formatMoney(r.amount, currency),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <Section title="Instalaciones">
        <MiniTable
          empty="Sin instalaciones."
          rows={installations}
          columns={[
            {
              key: "name",
              header: "Concepto",
              render: (r) => r.conceptNameSnapshot || "-",
            },
            {
              key: "qty",
              header: "Cant.",
              render: (r) => Number(r.quantity),
            },
            {
              key: "unit",
              header: "Unidad",
              render: (r) =>
                PROCESS_UNIT_LABELS[r.unitSnapshot] || r.unitSnapshot || "-",
            },
            ...(canViewCost
              ? [
                  {
                    key: "price",
                    header: "P. unit.",
                    render: (r) => formatMoney(r.unitPrice, currency),
                  },
                  {
                    key: "amount",
                    header: "Importe",
                    render: (r) => formatMoney(r.amount, currency),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      {(item.clientObservations || item.internalObservations) && (
        <Section title="Observaciones">
          <div className="space-y-2 text-sm">
            {item.clientObservations && (
              <div>
                <p className="text-xs text-content-muted">Cliente</p>
                <p className="whitespace-pre-wrap">{item.clientObservations}</p>
              </div>
            )}
            {item.internalObservations && (
              <div>
                <p className="text-xs text-content-muted">Internas</p>
                <p className="whitespace-pre-wrap">{item.internalObservations}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {(attachments.length > 0 || (quoteId && item.id)) && (
        <Section title="Documentos">
          <PartidaAttachments
            quoteId={quoteId}
            itemId={item.id}
            initialAttachments={attachments}
            canEdit={canEditAttachments}
            compact={compact}
          />
        </Section>
      )}

      <Section title="Resumen">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {canViewCost && (
            <>
              <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
                <dt className="text-content-muted">Costo</dt>
                <dd className="font-medium">{formatMoney(item.costTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
                <dt className="text-content-muted">Manufactura</dt>
                <dd>{formatMoney(item.manufacturingTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
                <dt className="text-content-muted">Materiales</dt>
                <dd>{formatMoney(item.materialsTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
                <dt className="text-content-muted">Extras</dt>
                <dd>{formatMoney(item.extrasTotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
                <dt className="text-content-muted">Instalaciones</dt>
                <dd>{formatMoney(item.installationsTotal, currency)}</dd>
              </div>
            </>
          )}
          {canViewBenefit && (
            <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
              <dt className="text-content-muted">Beneficio</dt>
              <dd>{Number(item.benefitPercentage) || 0}%</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
            <dt className="text-content-muted">Descuento</dt>
            <dd>
              {Number(item.discountPercentage)
                ? `${Number(item.discountPercentage)}%`
                : formatMoney(item.discountAmount, currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-muted/50 px-3 py-2">
            <dt className="text-content-muted">IVA</dt>
            <dd>{formatMoney(item.taxAmount, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-white px-3 py-2 font-semibold sm:col-span-2">
            <dt>Total partida</dt>
            <dd>{formatMoney(item.total, currency)}</dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}

export function partidaLineCounts(item) {
  return {
    manufacturing: item?.manufacturing?.length || 0,
    materials: item?.materials?.length || 0,
    extras: item?.extras?.length || 0,
    installations: item?.installations?.length || 0,
  };
}
