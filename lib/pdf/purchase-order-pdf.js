import "server-only";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf/helpers";
import { buildPurchaseOrderPrintModel, getComsaLogoPath } from "@/domains/purchase-orders/po-print";
import { drawPurchaseOrderForm } from "@/lib/pdf/forms/purchase-order-form.js";
import { PDF_OPTIONS } from "@/lib/pdf/forms/iso-form.js";

export function drawPurchaseOrderDocument(doc, po, extras = {}) {
  const model = buildPurchaseOrderPrintModel(po, extras);
  drawPurchaseOrderForm(doc, { ...model, logoPath: extras.logoPath ?? getComsaLogoPath() });
}

export async function buildPurchaseOrderPdfBuffer(po, extras = {}) {
  return buildPdfBuffer((doc) => {
    drawPurchaseOrderDocument(doc, po, extras);
  }, PDF_OPTIONS);
}

export async function purchaseOrderPdfResponse(po, extras = {}) {
  const buffer = await buildPurchaseOrderPdfBuffer(po, extras);
  return pdfResponse(buffer, `oc-${po.folio}.pdf`);
}
