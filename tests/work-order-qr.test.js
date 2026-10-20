import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkOrderModel,
  drawWorkOrder,
  PDF_OPTIONS,
} from "../lib/pdf/production-docs.js";
import { workOrderQrBox } from "../lib/pdf/forms/work-order-form.js";
import { buildProductionItemQr } from "../domains/production/qr.js";
import { buildPdfBuffer } from "../lib/pdf/helpers.js";
import { analyzePdf, textLines, verticalBorders } from "../scripts/dev/pdf-layout.mjs";

const ORDER = {
  id: "o1",
  folio: "2608-13",
  sourceType: "QUOTE",
  client: { commercialName: "SIGRAMA" },
  quote: { requestDate: "2026-08-04T00:00:00.000Z", seller: { name: "JALIL GIBRAN" } },
};

const ITEM = {
  id: "i1",
  position: 1,
  description: "11-E-9851-02",
  quantity: 530,
  commitmentDate: "2026-08-20T00:00:00.000Z",
  sourceMaterials: [],
  extraMaterials: [],
  processes: [{ processNameSnapshot: "CORTE LASER", status: "PENDING", sourceType: "QUOTE" }],
};

async function renderFirstPage(extras) {
  const model = buildWorkOrderModel(ORDER, ITEM, extras);
  const buffer = await buildPdfBuffer((doc) => drawWorkOrder(doc, model), PDF_OPTIONS);
  return analyzePdf(buffer).pages[0];
}

// Ancho aproximado de Helvetica: suficiente para detectar texto tapado por la imagen.
function approxRight(item) {
  return item.x + item.text.length * item.size * 0.6;
}

function qrImage(page) {
  const box = workOrderQrBox();
  return page.images.find(
    (img) => Math.abs(img.w - box.size) < 1 && Math.abs(img.h - box.size) < 1
  );
}

test("El QR cabe en la celda del titulo, sin cruzar fechas ni reticula", () => {
  const box = workOrderQrBox();
  assert.equal(box.size, 54);
  assert.ok(box.x >= 136.5);
  assert.ok(box.x + box.size <= 376.5);
  assert.ok(box.y >= 696);
  assert.ok(box.y + box.size <= 762.75);
});

test("PDF de orden de trabajo dibuja el QR real de la partida", async () => {
  const qr = await buildProductionItemQr("o1", "i1", "https://erp.example.com");
  assert.equal(qr.qrUrl, "https://erp.example.com/produccion/escaneo/o1/i1");
  const page = await renderFirstPage(qr);
  const img = qrImage(page);
  assert.ok(img, "el PDF debe incluir la imagen del QR");
  const box = workOrderQrBox();
  assert.ok(Math.abs(img.x - box.x) < 0.01);
  assert.ok(Math.abs(img.y - box.y) < 0.01);
});

test("El QR no tapa las fechas ni otro texto de la cabecera", async () => {
  const page = await renderFirstPage(await buildProductionItemQr("o1", "i1", "https://x.mx"));
  const img = qrImage(page);
  const lines = textLines(page).map((l) => l.text);
  assert.ok(lines.some((l) => l.includes("2026-08-04")), "fecha de solicitud visible");
  assert.ok(lines.some((l) => l.includes("2026-08-20")), "fecha final esperada visible");

  const overlapping = page.texts.filter(
    (t) =>
      t.text.trim() &&
      t.y >= img.y &&
      t.y <= img.y + img.h &&
      t.x < img.x + img.w &&
      approxRight(t) > img.x
  );
  assert.deepEqual(overlapping.map((t) => t.text), []);
});

test("El QR no cruza lineas de la reticula", async () => {
  const page = await renderFirstPage(await buildProductionItemQr("o1", "i1", "https://x.mx"));
  const img = qrImage(page);
  const crossing = verticalBorders(page).filter(
    (b) => b.x > img.x && b.x < img.x + img.w && b.y1 < img.y + img.h && b.y2 > img.y
  );
  assert.deepEqual(crossing, []);
});

test("Con QR el titulo sigue completo, junto al codigo", async () => {
  const page = await renderFirstPage(await buildProductionItemQr("o1", "i1", "https://x.mx"));
  const img = qrImage(page);
  const titleParts = page.texts.filter((t) => /ORDEN|COTIZADO/.test(t.text));
  assert.equal(titleParts.map((t) => t.text.trim()).join(" "), "ORDEN DE TRABAJO COTIZADO");
  for (const part of titleParts) assert.ok(approxRight(part) <= img.x);
});

test("Sin QR el titulo conserva la posicion del machote", async () => {
  const page = await renderFirstPage({});
  assert.equal(qrImage(page), undefined);
  const title = page.texts.find((t) => t.text.includes("ORDEN DE TRABAJO COTIZADO"));
  assert.ok(title);
  assert.equal(title.y, 726);
});
