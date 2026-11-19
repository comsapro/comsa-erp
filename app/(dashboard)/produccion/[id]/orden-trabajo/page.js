import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { getWorkOrderPrintModel } from "@/domains/production/documents";
import PrintActions from "./PrintActions";

export const metadata = { title: "Orden de trabajo" };

const cell = "border border-black px-1.5 py-1 align-top text-xs leading-tight";
const th = `${cell} bg-white font-semibold`;

export default async function OrdenTrabajoPage({ params, searchParams }) {
  await requirePagePermission("production.print");
  const { id } = await params;
  const sp = await searchParams;
  const itemId = sp?.itemId || "";
  if (!itemId) notFound();

  let payload;
  try {
    payload = await getWorkOrderPrintModel(id, itemId, {
      url: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "",
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      notFound();
    }
    throw error;
  }

  const { model } = payload;
  const materials = model.materials.length ? model.materials : [null];
  const processes = model.processes.length ? model.processes : [];

  return (
    <div className="print-quote mx-auto max-w-[900px] bg-white px-3 py-4 text-black">
      <PrintActions backHref={`/produccion/${id}`} />

      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} w-[22%] p-2`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/comsa-logo.jpeg"
                alt="COMSA"
                className="mx-auto h-14 w-auto object-contain"
              />
              <p className="mt-1 text-center text-[10px] font-semibold">
                {model.sheetLabel}
              </p>
            </td>
            <td className={`${cell} text-center text-sm font-semibold`}>
              {model.title}
            </td>
            <td className={`${cell} w-[34%]`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p>
                    <span className="font-semibold">Código de trabajo</span>
                  </p>
                  <p className="text-base font-semibold">{model.workCode}</p>
                  <p className="mt-1">
                    <span className="font-semibold">Fecha de solicitud: </span>
                    {model.requestDate || "—"}
                  </p>
                  <p>
                    <span className="font-semibold">Fecha final esperada: </span>
                    {model.expectedDate || "—"}
                  </p>
                </div>
                {model.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={model.qrDataUrl}
                    alt="Codigo QR de la partida"
                    className="h-16 w-16 shrink-0 object-contain"
                  />
                ) : null}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th} colSpan={2}>
                Datos del proyecto
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} w-[38%] font-semibold`}>Nombre de la pieza</td>
              <td className={cell}>{model.pieceName || "—"}</td>
            </tr>
            <tr>
              <td className={`${cell} font-semibold`}>Vendedor</td>
              <td className={cell}>{model.seller || "—"}</td>
            </tr>
            <tr>
              <td className={`${cell} font-semibold`}>Empresa</td>
              <td className={cell}>{model.company || "—"}</td>
            </tr>
            <tr>
              <td className={`${cell} font-semibold`}>No. piezas</td>
              <td className={cell}>{model.quantity || "—"}</td>
            </tr>
            <tr>
              <td className={`${cell} font-semibold`}>La pieza se fabrica contra</td>
              <td className={cell}>Muestra · Plano · Indicaciones</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Procesos estándar</th>
            </tr>
          </thead>
          <tbody>
            {(model.processNames.length ? model.processNames : ["—"]).map((name, index) => (
              <tr key={`${name}-${index}`}>
                <td className={cell}>{name}</td>
              </tr>
            ))}
            <tr>
              <td className={`${cell} text-center font-semibold`}>
                Observaciones del vendedor
              </td>
            </tr>
            <tr>
              <td className={`${cell} min-h-10 whitespace-pre-wrap`}>
                {model.observations || " "}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-4 text-center text-sm font-semibold">Liberación de material</h2>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr>
            {["Unidad", "Cantidad", "Descripción", "Dimensiones", "Presentación", "Proveedor"].map(
              (header) => (
                <th key={header} className={th}>
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {materials.map((material, index) => (
            <tr key={material?.description || `mat-${index}`} className="print-row">
              <td className={cell}>{material?.unit || ""}</td>
              <td className={cell}>{material?.quantity || ""}</td>
              <td className={cell}>{material?.description || ""}</td>
              <td className={cell}>{material?.dimensions || ""}</td>
              <td className={cell}>{material?.presentation || ""}</td>
              <td className={cell}>{material?.supplier || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-3">
        {processes.length === 0 ? (
          <p className="text-xs">Sin procesos estándar en esta partida.</p>
        ) : (
          processes.map((block, index) => (
            <article key={`${block.name}-${index}`} className="print-row border border-black">
              <h3 className="border-b border-black px-2 py-1 text-sm font-semibold">
                {block.name}
              </h3>
              {block.notes ? (
                <p className="border-b border-black px-2 py-1 text-xs whitespace-pre-wrap">
                  <span className="font-semibold">Para qué es este proceso en la pieza: </span>
                  {block.notes}
                </p>
              ) : null}
              <div className="grid grid-cols-2 text-xs">
                <p className="border-b border-r border-black px-2 py-1">
                  <span className="font-semibold">Fecha de inicio: </span>
                  {block.startDate || ""}
                </p>
                <p className="border-b border-black px-2 py-1">
                  <span className="font-semibold">Horas usadas: </span>
                  {block.hours || ""}
                </p>
                <p className="border-r border-black px-2 py-1">
                  <span className="font-semibold">Operador: </span>
                  {block.operator || ""}
                </p>
                <p className="px-2 py-1">
                  <span className="font-semibold">Fecha de finalización: </span>
                  {block.endDate || ""}
                </p>
              </div>
              <div className="border-t border-black px-2 py-2 text-center text-[11px]">
                <p>
                  Estoy recibiendo el material descrito en esta orden de trabajo y al firmar
                  estoy aceptando las características del mismo.
                </p>
                <p className="mt-6">_______________________</p>
                <p>Firma del vendedor o cliente</p>
              </div>
            </article>
          ))
        )}
      </div>

      <p className="mt-4 text-[11px]">
        Revisión 3 · Fecha de revisión: 25 de noviembre de 2026 · COM-OT-R-001
      </p>
    </div>
  );
}
