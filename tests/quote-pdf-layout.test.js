import test from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import {
  buildQuotePrintModel,
  commentsGoBelow,
  COMMENT_INLINE_MAX_CHARS,
} from "../domains/quotes/quote-print.js";
import {
  drawQuoteForm,
  wrapCell,
  COMMENTS_BELOW_LABEL,
} from "../lib/pdf/forms/quote-form.js";
import { createIsoForm, PDF_OPTIONS } from "../lib/pdf/forms/iso-form.js";
import { buildPdfBuffer } from "../lib/pdf/helpers.js";
import { analyzePdf, textLines } from "../scripts/dev/pdf-layout.mjs";

const PHRASE = "Las piezas seran fabricadas en acero inox 304";

function quoteWith(comments, { description = "Prueba del dia 18.10.2026" } = {}) {
  return {
    folio: "2610-8-A",
    currency: "MXN",
    subtotal: 255750,
    taxTotal: 40920,
    total: 296670,
    items: [
      {
        position: 1,
        description,
        quantity: 15,
        status: "ACTIVE",
        unitSalePrice: 17050,
        saleSubtotal: 255750,
        discountAmount: 0,
        deliveryTimeMin: 15,
        deliveryTimeMax: 20,
        deliveryTimeUnit: "DAY",
        clientObservations: comments,
      },
    ],
  };
}

async function renderPages(quote) {
  const model = { ...buildQuotePrintModel(quote), logoPath: null };
  const buffer = await buildPdfBuffer((doc) => drawQuoteForm(doc, model), PDF_OPTIONS);
  return analyzePdf(buffer).pages.map((page) =>
    textLines(page).map((line) => line.text)
  );
}

const normalize = (s) => s.replace(/\s+/g, " ").trim();

test("comentarios cortos van en su columna; largos en una fila de ancho completo", () => {
  assert.equal(commentsGoBelow("x".repeat(COMMENT_INLINE_MAX_CHARS)), false);
  assert.equal(commentsGoBelow("x".repeat(COMMENT_INLINE_MAX_CHARS + 1)), true);
  assert.equal(commentsGoBelow(null), false);
  const model = buildQuotePrintModel(quoteWith(PHRASE.repeat(40)));
  assert.equal(model.items[0].commentsBelow, true);
});

test("PDF: comentario largo se imprime completo, sin recortar", async () => {
  const comment = Array.from({ length: 45 }, () => PHRASE).join(" ");
  const pages = await renderPages(quoteWith(comment));
  const all = normalize(pages.flat().join(" "));
  assert.ok(all.includes(normalize(`Comentarios: ${comment}`)));
  assert.ok(!all.includes("..."), "no debe haber texto recortado");
  assert.ok(pages[0].some((line) => line.includes(COMMENTS_BELOW_LABEL)));
});

test("PDF: la partida queda en la primera pagina aunque el comentario sea enorme", async () => {
  const comment = Array.from({ length: 300 }, () => PHRASE).join(" ");
  const pages = await renderPages(quoteWith(comment));
  assert.ok(pages.length >= 2, "el comentario debe continuar en otra pagina");
  const first = pages[0].join(" ");
  assert.ok(first.includes("$255,750.00"), "el importe se imprime en la primera pagina");
  assert.ok(first.includes("Comentarios:"), "el comentario inicia en la primera pagina");
  assert.ok(pages[1].join(" ").includes("Descripción"), "se repite el encabezado de la tabla");
  const header = new Set(["#DescripciónTiempoComentariosPrecioDescuentoCantidadImporte", "deUnitario", "entrega"]);
  const all = normalize(
    pages.map((page, i) => (i === 0 ? page : page.filter((line) => !header.has(line)))).flat().join(" ")
  );
  assert.ok(all.includes(normalize(comment)));
  assert.ok(all.includes("Total con IVA"));
});

test("PDF: comentario corto se queda en la columna", async () => {
  const pages = await renderPages(quoteWith("Entrega en planta"));
  const all = pages.flat().join(" ");
  // La columna es angosta: el texto se ajusta a dos lineas que comparten base con otras columnas.
  assert.ok(all.includes("Entrega en"));
  assert.ok(all.includes("planta"));
  assert.ok(!all.includes("Comentarios:"));
  assert.ok(!all.includes(COMMENTS_BELOW_LABEL));
});

test("PDF: descripcion larga se ajusta en varias lineas en lugar de cortarse", async () => {
  const description = Array.from({ length: 12 }, (_, i) => `Pieza mecanizada parte ${i + 1}`).join(" ");
  const pages = await renderPages(quoteWith("", { description }));
  const all = normalize(pages.flat().join(" "));
  assert.ok(all.includes("Pieza mecanizada parte 12"));
  assert.ok(!all.includes("..."));
});

test("wrapCell respeta saltos de linea y corta palabras mas anchas que la celda", () => {
  const doc = new PDFDocument(PDF_OPTIONS);
  const form = createIsoForm(doc);
  const lines = wrapCell(form, `uno\ndos\n${"A".repeat(60)}`, 40);
  assert.equal(lines[0], "uno");
  assert.equal(lines[1], "dos");
  assert.ok(lines.length > 3);
  for (const line of lines) {
    assert.ok(form.width(line, { size: 6.75 }) <= 40);
  }
  assert.equal(lines.slice(2).join(""), "A".repeat(60));
  doc.end();
});
