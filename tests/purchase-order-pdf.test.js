import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPurchaseOrderPrintModel,
  formatPoDateTime,
  formatPoQuantity,
  mapPurchaseOrderLine,
  partNumberOf,
  PO_DOC_CODE,
} from "../domains/purchase-orders/po-print.js";
import { drawPurchaseOrderForm } from "../lib/pdf/forms/purchase-order-form.js";
import { PDF_OPTIONS } from "../lib/pdf/forms/iso-form.js";
import { buildPdfBuffer } from "../lib/pdf/helpers.js";
import { analyzePdf, textLines } from "../scripts/dev/pdf-layout.mjs";

export const PO_SAMPLE_PO = {
  folio: "2406-1",
  createdAt: new Date("2024-06-06T19:10:04.000Z"),
  requestDate: new Date("2024-06-06T00:00:00.000Z"),
  comments: "",
  subtotal: 4000,
  tax: 640,
  total: 4640,
  supplier: { name: "La Paloma Compañía de Metales S.A. de C.V." },
  requestedByUser: { name: "Ricardo Rodriguez" },
  quote: { folio: "2306-1", currency: "MXN" },
  items: [
    {
      sourceMaterialId: "m1",
      sourceType: "QUOTE_MATERIAL",
      descriptionSnapshot: "A36",
      quantity: 1,
      unitPrice: 3000,
      subtotal: 3000,
      item: { sku: "LEGACY-1", name: "A36" },
    },
    {
      sourceMaterialId: "m2",
      sourceType: "QUOTE_MATERIAL",
      descriptionSnapshot: "10 45",
      quantity: 2,
      unitPrice: 500,
      subtotal: 1000,
      item: { sku: "LEGACY-2", name: "1045" },
    },
  ],
};

export const PO_SAMPLE_MATERIALS = {
  m1: { descriptionSnapshot: "A36", presentation: "REDONDO", dimensions: "10 X 15" },
  m2: { descriptionSnapshot: "10 45", presentation: "REDONDO", dimensions: "5 X 8" },
};

function pdfTexts(buffer) {
  const analysis = analyzePdf(buffer);
  return analysis.pages.flatMap((page) => textLines(page).map((line) => line.text));
}

test("Fecha de OC se imprime en zona Mexico con hora", () => {
  assert.equal(formatPoDateTime(new Date("2024-06-06T19:10:04.000Z")), "2024-06-06 13:10:04");
});

test("Cantidad de OC sin ceros de mas y SKU legado como NA", () => {
  assert.equal(formatPoQuantity(1), "1");
  assert.equal(formatPoQuantity(2.5), "2.5");
  assert.equal(partNumberOf({ item: { sku: "LEGACY-9" } }), "NA");
  assert.equal(partNumberOf({ item: { sku: "A36-RED" } }), "A36-RED");
});

test("Linea de OC toma tipo, presentacion y dimensiones del material de cotizacion", () => {
  const line = mapPurchaseOrderLine(
    PO_SAMPLE_PO.items[0],
    0,
    PO_SAMPLE_MATERIALS.m1
  );
  assert.equal(line.position, 1);
  assert.equal(line.partNumber, "NA");
  assert.equal(line.materialType, "A36");
  assert.equal(line.description, "REDONDO");
  assert.equal(line.dimensions, "10 X 15");
  assert.equal(line.quantity, "1");
  assert.equal(line.unitPrice, "$3,000.00");
});

test("PDF COM-ALM-R-01 incluye encabezado, columnas, totales e instrucciones", async () => {
  const model = buildPurchaseOrderPrintModel(PO_SAMPLE_PO, {
    materialsById: PO_SAMPLE_MATERIALS,
    logoPath: null,
  });
  assert.equal(model.docCode, PO_DOC_CODE);
  assert.equal(model.meta.cotizacion, "2306-1");
  assert.equal(model.items[1].materialType, "10 45");

  const buffer = await buildPdfBuffer((doc) => {
    drawPurchaseOrderForm(doc, { ...model, logoPath: null });
  }, PDF_OPTIONS);
  const lines = pdfTexts(buffer).join(" | ");

  assert.match(lines, /ORDEN DE COMPRA #2406-1/);
  assert.match(lines, /Proveedor/);
  assert.match(lines, /La Paloma/);
  assert.match(lines, /Solicitante/);
  assert.match(lines, /Ricardo Rodriguez/);
  assert.match(lines, /No\. Cotizacion/);
  assert.match(lines, /2306-1/);
  assert.match(lines, /Direcci[oó]n de envi[oó]/);
  assert.match(lines, /Facturar a:/);
  assert.match(lines, /No\. Parte/);
  assert.match(lines, /Tipo Material/);
  assert.match(lines, /Dimensiones/);
  assert.match(lines, /Cant\/Unid/);
  assert.match(lines, /REDONDO/);
  assert.match(lines, /10 X 15/);
  assert.match(lines, /PRECIOS EN MXN/);
  assert.match(lines, /Subtotal sin IVA/);
  assert.match(lines, /\$4,000\.00/);
  assert.match(lines, /FIRMA DE DIRECCION GENERAL/);
  assert.match(lines, /SELLO DE COMSA/);
  assert.match(lines, /Instrucciones para facturar/);
  assert.match(lines, /COM-ALM-R-01/);
  assert.match(lines, /Revisi[oó]n 1\.1/);
});
