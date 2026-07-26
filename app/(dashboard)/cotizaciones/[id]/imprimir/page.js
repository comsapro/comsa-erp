import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import PrintButton from "./PrintButton";

export const metadata = { title: "Imprimir cotizacion" };

async function getQuoteForPrint(id) {
  return prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      clientContact: true,
      seller: { select: { id: true, name: true, email: true } },
      issuingCompany: true,
      items: {
        where: { status: "ACTIVE" },
        orderBy: { position: "asc" },
      },
    },
  });
}

export default async function ImprimirCotizacionPage({ params }) {
  await requirePagePermission("quotes.print");
  const { id } = await params;
  const quote = await getQuoteForPrint(id);
  if (!quote) notFound();

  const currency = quote.currency || "MXN";
  const company = quote.issuingCompany;
  const client = quote.client;

  return (
    <div className="print-quote mx-auto max-w-4xl bg-white text-content">
      <div className="no-print mb-6 flex justify-end gap-2">
        <Button as={Link} href={`/cotizaciones/${quote.id}`} variant="secondary">
          Volver
        </Button>
        <PrintButton />
      </div>

      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.commercialName || "Logo"}
              className="mb-3 h-14 object-contain"
            />
          ) : (
            <p className="text-xl font-semibold tracking-tight">
              {company?.commercialName || "COMSA"}
            </p>
          )}
          {company?.legalName && (
            <p className="text-sm text-content-muted">{company.legalName}</p>
          )}
          {company?.fiscalAddress && (
            <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-content-muted">
              {company.fiscalAddress}
            </p>
          )}
          {company?.rfc && (
            <p className="text-xs text-content-muted">RFC: {company.rfc}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-content-muted">
            Cotizacion
          </p>
          <p className="text-2xl font-semibold">{quote.folio}</p>
          <p className="mt-1 text-sm text-content-muted">
            {QUOTE_STATUS_LABELS[quote.status] || quote.status}
          </p>
          <p className="mt-2 text-sm">
            Elaboracion: {formatDate(quote.elaborationDate)}
          </p>
          <p className="text-sm">Vigencia: {formatDate(quote.validUntil)}</p>
        </div>
      </header>

      <section className="mb-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Cliente
          </h2>
          <p className="font-medium">{client?.commercialName || "-"}</p>
          {client?.legalName && (
            <p className="text-sm text-content-muted">{client.legalName}</p>
          )}
          {client?.rfc && (
            <p className="text-sm text-content-muted">RFC: {client.rfc}</p>
          )}
          {client?.address && (
            <p className="mt-1 whitespace-pre-wrap text-sm">{client.address}</p>
          )}
          {quote.clientContact && (
            <p className="mt-2 text-sm">
              Contacto: {quote.clientContact.name}
              {quote.clientContact.email
                ? ` · ${quote.clientContact.email}`
                : ""}
            </p>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Comercial
          </h2>
          <p className="text-sm">Vendedor: {quote.seller?.name || "-"}</p>
          <p className="text-sm">Moneda: {currency}</p>
          {quote.purchaseOrder && (
            <p className="text-sm">OC: {quote.purchaseOrder}</p>
          )}
          {quote.requisition && (
            <p className="text-sm">Requisicion: {quote.requisition}</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-content text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Descripcion</th>
              <th className="py-2 pr-2 text-right font-semibold">Cant.</th>
              <th className="py-2 pr-2 font-semibold">Unidad</th>
              <th className="py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(quote.items || []).map((item) => (
              <tr key={item.id} className="border-b border-border align-top">
                <td className="py-3 pr-2 text-content-muted">{item.position}</td>
                <td className="py-3 pr-2">
                  <p className="font-medium">{item.description}</p>
                  {item.clientObservations && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-content-muted">
                      {item.clientObservations}
                    </p>
                  )}
                  {(item.deliveryTimeMin != null ||
                    item.deliveryTimeMax != null) && (
                    <p className="mt-1 text-xs text-content-muted">
                      Entrega: {item.deliveryTimeMin ?? "?"}
                      {item.deliveryTimeMax != null
                        ? `–${item.deliveryTimeMax}`
                        : ""}{" "}
                      {item.deliveryTimeUnit || "dias"}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-2 text-right">{Number(item.quantity)}</td>
                <td className="py-3 pr-2">{item.unit || "-"}</td>
                <td className="py-3 text-right font-medium">
                  {formatMoney(item.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-content-muted">Subtotal</dt>
            <dd>{formatMoney(quote.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-content-muted">Descuento</dt>
            <dd>{formatMoney(quote.discountTotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-content-muted">IVA</dt>
            <dd>{formatMoney(quote.taxTotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-border pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(quote.total, currency)}</dd>
          </div>
        </dl>
      </section>

      {(quote.paymentNotes ||
        Number(quote.advancePercentage) > 0 ||
        Number(quote.settlementPercentage) !== 100) && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Condiciones de pago
          </h2>
          {quote.paymentNotes && (
            <p className="whitespace-pre-wrap text-sm">{quote.paymentNotes}</p>
          )}
          <p className="mt-2 text-sm text-content-muted">
            Anticipo {Number(quote.advancePercentage)}% · Liquidacion{" "}
            {Number(quote.settlementPercentage)}%
          </p>
        </section>
      )}

      <footer className="border-t border-border pt-6 text-xs text-content-muted">
        {company?.legalText && (
          <p className="mb-3 whitespace-pre-wrap">{company.legalText}</p>
        )}
        <p>
          Documento generado por COMSA ERP · Folio {quote.folio} · Version{" "}
          {quote.version}
        </p>
      </footer>
    </div>
  );
}
