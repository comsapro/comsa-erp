/**
 * Recalcula importes de partidas como precio por pieza x cantidad.
 *
 * - Borradores y pendientes de aprobacion: se recalculan (con --apply).
 * - Otros estatus con diferencia: solo se reportan en el CSV, no se modifican.
 * - Sin diferencia: se guarda unitSalePrice para que el PDF lo use directo.
 * - Cotizaciones legacy ([legacy:] en internalObservations): se omiten.
 *
 * Uso:
 *   node --env-file=.env scripts/recalc-quote-quantities.mjs           (simulacion)
 *   node --env-file=.env scripts/recalc-quote-quantities.mjs --apply
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  planQuoteQuantityRecalc,
  recalcDecision,
} from "../lib/quotes/quantity-recalc.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REPORT_PATH = `recalc-cotizaciones-${new Date().toISOString().slice(0, 10)}.csv`;

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const quotes = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      NOT: { internalObservations: { startsWith: "[legacy:" } },
    },
    orderBy: { folio: "asc" },
    select: {
      id: true,
      folio: true,
      status: true,
      total: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          manufacturing: true,
          materials: true,
          extras: true,
          installations: true,
        },
      },
    },
  });

  const counts = { apply: 0, report: 0, backfill: 0 };
  const rows = [];

  for (const quote of quotes) {
    const plan = planQuoteQuantityRecalc(quote);
    const decision = recalcDecision(quote, plan);
    counts[decision] += 1;

    if (decision !== "backfill") {
      rows.push([
        quote.folio,
        quote.status,
        plan.previousTotal.toFixed(2),
        plan.newTotal.toFixed(2),
        decision === "apply" ? "recalculada" : "sin cambios (reportada)",
      ]);
    }
    if (!APPLY || decision === "report") continue;

    await prisma.$transaction(async (tx) => {
      for (const item of plan.items) {
        await tx.quoteItem.update({
          where: { id: item.id },
          data:
            decision === "apply"
              ? item.data
              : { unitSalePrice: item.data.unitSalePrice },
        });
      }
      if (decision === "apply") {
        await tx.quote.update({ where: { id: quote.id }, data: plan.header });
        await tx.auditLog.create({
          data: {
            module: "quotes",
            entity: "Quote",
            entityId: quote.id,
            action: "update",
            previousData: { total: plan.previousTotal, reason: "precio_por_pieza_x_cantidad" },
            newData: { total: plan.newTotal },
          },
        });
      }
    });
  }

  const header = ["folio", "estatus", "total_actual", "total_corregido", "accion"];
  writeFileSync(
    REPORT_PATH,
    [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n"
  );

  console.log(APPLY ? "Modo: APLICAR" : "Modo: SIMULACION (usa --apply para guardar)");
  console.log(`  Recalculadas (borrador/pendiente): ${counts.apply}`);
  console.log(`  Con diferencia, solo reporte:      ${counts.report}`);
  console.log(`  Sin diferencia (unitSalePrice):    ${counts.backfill}`);
  console.log(`  Reporte: ${REPORT_PATH}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
