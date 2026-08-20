import "server-only";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf/helpers";
import { buildQuotePrintModel, getComsaLogoPath } from "@/domains/quotes/quote-print";
import { drawQuoteForm } from "@/lib/pdf/forms/quote-form.js";
import { PDF_OPTIONS } from "@/lib/pdf/forms/iso-form.js";

export function drawQuoteDocument(doc, quote) {
  const model = buildQuotePrintModel(quote);
  drawQuoteForm(doc, { ...model, logoPath: getComsaLogoPath() });
}

export async function buildQuotePdfBuffer(quote) {
  return buildPdfBuffer((doc) => {
    drawQuoteDocument(doc, quote);
  }, PDF_OPTIONS);
}

export async function quotePdfResponse(quote) {
  const buffer = await buildQuotePdfBuffer(quote);
  return pdfResponse(buffer, `cotizacion-${quote.folio}.pdf`);
}
