import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { buildQuotePrintModel } from "@/domains/quotes/quote-print";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import PrintButton from "./PrintButton";

export const metadata = { title: "Imprimir cotizacion" };

const cell = "border border-black px-1.5 py-1 align-top";
const cellCenter = `${cell} text-center`;
const cellRight = `${cell} text-right`;
const th = `${cell} bg-white text-center font-semibold`;

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

  if (!["APPROVED", "IN_PRODUCTION"].includes(quote.status)) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Alert variant="warning" title="No disponible para imprimir">
          Solo las cotizaciones aprobadas pueden imprimirse o exportarse a PDF.
        </Alert>
        <div className="mt-4">
          <Button as={Link} href={`/cotizaciones/${id}`} variant="secondary">
            Volver a la cotizacion
          </Button>
        </div>
      </div>
    );
  }

  const model = buildQuotePrintModel(quote);

  return (
    <div className="print-quote mx-auto max-w-[900px] bg-white px-3 py-4 text-black">
      <div className="no-print mb-6 flex justify-end gap-2">
        <Button as={Link} href={`/cotizaciones/${quote.id}`} variant="secondary">
          Volver
        </Button>
        <PrintButton />
      </div>

      {/* Header con borde */}
      <table className="mb-0 w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} w-[28%] p-2`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.company.logoUrl || "/branding/comsa-logo.jpeg"}
                alt="COMSA"
                className="mx-auto h-16 w-auto object-contain"
              />
            </td>
            <td className={`${cell} p-2 leading-snug`}>
              <p className="font-bold">{model.company.legalName}</p>
              {model.company.phone ? <p>Tel: {model.company.phone}</p> : null}
              {model.company.phone ? <p>Cel: {model.company.phone}</p> : null}
              {model.company.email ? <p>{model.company.email}</p> : null}
              {model.company.address ? (
                <p className="whitespace-pre-wrap">{model.company.address}</p>
              ) : null}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className={`${cellCenter} py-2 text-base font-bold`}>
              COTIZACION #{model.folio}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} w-[14%] font-semibold`}>Empresa</td>
            <td className={`${cell} w-[36%]`}>{model.meta.empresa}</td>
            <td className={`${cell} w-[14%] font-semibold`}>Requisicion</td>
            <td className={`${cell} w-[36%]`}>{model.meta.requisicion}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Responsable</td>
            <td className={cell}>{model.meta.responsable}</td>
            <td className={`${cell} font-semibold`}>Emitida</td>
            <td className={cell}>{model.meta.emitida}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Atentamente</td>
            <td className={cell}>{model.meta.atentamente}</td>
            <td className={`${cell} font-semibold`}>Vigencia hasta</td>
            <td className={cell}>{model.meta.vigenciaHasta}</td>
          </tr>
        </tbody>
      </table>

      {/* Partidas */}
      <table className="w-full border-collapse text-[10px] leading-snug">
        <thead>
          <tr>
            <th className={`${th} w-6`}>#</th>
            <th className={th}>Descripcion</th>
            <th className={`${th} w-[11%]`}>Tiempo de entrega</th>
            <th className={`${th} w-[12%]`}>Comentarios</th>
            <th className={`${th} w-[11%]`}>Precio Unitario</th>
            <th className={`${th} w-[9%]`}>Descuento</th>
            <th className={`${th} w-[8%]`}>Cantidad</th>
            <th className={`${th} w-[10%]`}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {model.items.length === 0 ? (
            <tr>
              <td className={cellCenter} colSpan={8}>
                &nbsp;
              </td>
            </tr>
          ) : (
            model.items.map((item) => (
              <tr key={item.position} className="print-row">
                <td className={cellCenter}>{item.position}</td>
                <td className={cell}>{item.description}</td>
                <td className={`${cellCenter} whitespace-pre-line`}>
                  {item.deliveryRange}
                  {item.deliveryUnit ? `\n${item.deliveryUnit}` : ""}
                </td>
                <td className={cell}>{item.comments || ""}</td>
                <td className={cellRight}>{item.unitPrice}</td>
                <td className={cellRight}>{item.discount}</td>
                <td className={cellRight}>{item.quantity}</td>
                <td className={cellRight}>{item.amount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totales */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td
              rowSpan={3}
              className={`${cellCenter} w-[62%] font-semibold uppercase`}
            >
              {model.currencyBanner}
            </td>
            <td className={`${cell} w-[22%] font-semibold`}>Subtotal sin IVA</td>
            <td className={`${cellRight} w-[16%]`}>{model.totals.subtotal}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>IVA</td>
            <td className={cellRight}>{model.totals.tax}</td>
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>Total con IVA</td>
            <td className={`${cellRight} font-bold`}>{model.totals.total}</td>
          </tr>
        </tbody>
      </table>

      {/* Notas */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th colSpan={2} className={`${th} text-sm`}>
              NOTAS
            </th>
          </tr>
        </thead>
        <tbody>
          {model.notes.map((note, idx) => (
            <tr key={note}>
              <td className={`${cellCenter} w-8 font-semibold`}>{idx + 1}</td>
              <td className={cell}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cancelacion */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th colSpan={2} className={`${th} text-sm`}>
              CANCELACION O CAMBIO
            </th>
          </tr>
        </thead>
        <tbody>
          {model.cancellation.map((row) => (
            <tr key={row.key}>
              <td className={`${cellCenter} w-8 font-semibold`}>{row.key}</td>
              <td className={cell}>{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pie */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} w-[48%] align-middle`}>
              En caso de vernos favorecidos con su pedido por favor dirigirlo a:
            </td>
            <td className={`${cell} w-[52%] leading-snug`}>
              <p className="font-bold">{model.company.legalName}</p>
              {model.company.email ? (
                <p>E-mail: {model.company.email}</p>
              ) : null}
              {model.company.rfc ? <p>RFC :{model.company.rfc}</p> : null}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-2 text-[11px] text-neutral-600">{model.revisionLabel}</p>
    </div>
  );
}
