import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { buildQuotePrintModel } from "@/domains/quotes/quote-print";
import { quoteCanPrint } from "@/domains/quotes/constants";
import { assertQuoteInScope } from "@/domains/quotes/access";
import { NotFoundError } from "@/lib/permissions/errors";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";
import PrintButton from "./PrintButton";

export const metadata = { title: "Imprimir cotizacion" };

const cell =
  "border border-black px-1.5 py-1 align-middle text-center leading-tight";
const cellLeft = `${cell} text-left`;
const cellRight = `${cell} text-right`;
const th = `${cell} bg-white font-semibold`;

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
  try {
    await assertQuoteInScope(quote);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if (!quoteCanPrint(quote)) {
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

      {/* Header con borde — tablas encadenadas sin huecos entre secciones */}
      <table className="w-full border-collapse text-xs">
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
            <td className={`${cellLeft} p-2 leading-snug`}>
              <p className="font-bold">{model.company.legalName}</p>
              {model.company.phone ? <p>Tel: {model.company.phone}</p> : null}
              {model.company.cellPhone ? <p>Cel: {model.company.cellPhone}</p> : null}
              {model.company.email ? <p>{model.company.email}</p> : null}
              {model.company.address ? (
                <p className="whitespace-pre-wrap">{model.company.address}</p>
              ) : null}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className={`${cell} py-1.5 text-base font-bold`}>
              COTIZACION #{model.folio}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${th} w-[14%]`}>Empresa</td>
            <td className={`${cell} w-[36%]`}>{model.meta.empresa}</td>
            <td className={`${th} w-[14%]`}>Requisición</td>
            <td className={`${cell} w-[36%]`}>{model.meta.requisicion}</td>
          </tr>
          <tr>
            <td className={th}>Responsable</td>
            <td className={cell}>{model.meta.responsable}</td>
            <td className={th}>Emitida</td>
            <td className={cell}>{model.meta.emitida}</td>
          </tr>
          <tr>
            <td className={th}>Atentamente</td>
            <td className={cell}>{model.meta.atentamente}</td>
            <td className={th}>Vigencia hasta</td>
            <td className={cell}>{model.meta.vigenciaHasta}</td>
          </tr>
        </tbody>
      </table>

      {/* Partidas */}
      <table className="w-full border-collapse text-[10px] leading-snug">
        <thead>
          <tr>
            <th className={`${th} w-6`}>#</th>
            <th className={th}>Descripción</th>
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
              <td className={cell} colSpan={8}>
                &nbsp;
              </td>
            </tr>
          ) : (
            model.items.map((item) => (
              <tr key={item.position} className="print-row">
                <td className={cell}>{item.position}</td>
                <td className={cellLeft}>{item.description}</td>
                <td className={`${cell} whitespace-pre-line`}>
                  {item.deliveryRange}
                  {item.deliveryUnit ? `\n${item.deliveryUnit}` : ""}
                </td>
                <td className={cellLeft}>{item.comments || ""}</td>
                <td className={cellRight}>{item.unitPrice}</td>
                <td className={cellRight}>{item.discount}</td>
                <td className={cell}>{item.quantity}</td>
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
            <td rowSpan={3} className={`${cell} w-[62%] font-semibold uppercase`}>
              {model.currencyBanner}
            </td>
            <td className={`${th} w-[22%]`}>Subtotal sin IVA</td>
            <td className={`${cellRight} w-[16%]`}>{model.totals.subtotal}</td>
          </tr>
          <tr>
            <td className={th}>IVA</td>
            <td className={cellRight}>{model.totals.tax}</td>
          </tr>
          <tr>
            <td className={`${th} font-bold`}>Total con IVA</td>
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
              <td className={`${th} w-8`}>{idx + 1}</td>
              <td className={cellLeft}>{note}</td>
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
              <td className={`${th} w-8`}>{row.key}</td>
              <td className={cellLeft}>{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pie */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} w-[48%] px-2 py-2`}>
              En caso de vernos favorecidos con su pedido por favor dirigirlo a:
            </td>
            <td className={`${cellLeft} w-[52%] px-2 py-2 leading-snug`}>
              <p className="font-bold">{model.company.footerName}</p>
              {model.company.email ? (
                <p>E-mail: {model.company.email}</p>
              ) : null}
              {model.company.rfc ? <p>RFC :{model.company.rfc}</p> : null}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-1.5 text-left text-[11px] text-neutral-600">
        {model.revisionLabel}
      </p>
    </div>
  );
}
