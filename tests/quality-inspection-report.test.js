import test from "node:test";
import assert from "node:assert/strict";
import { buildPdfBuffer } from "../lib/pdf/helpers.js";
import {
  drawQualityInspectionReportForm,
  QUALITY_INSPECTION_PDF_OPTIONS,
} from "../lib/pdf/forms/quality-inspection-report-form.js";
import { buildInspectionReportModel } from "../domains/quality/inspection-report-model.js";
import { analyzePdf, textLines } from "../scripts/dev/pdf-layout.mjs";

function inspectionWithAnnotations(count = 2, readings = 4) {
  return {
    status: "CLOSED",
    createdAt: new Date("2026-11-07T12:00:00Z"),
    productionOrder: {
      folio: "2610-6-A",
      client: { commercialName: "Cliente de prueba" },
    },
    productionItem: {
      position: 1,
      description: "Soporte de prueba",
      quantity: 20,
      qualityConfig: {
        inspectionMode: "SAMPLE",
        sampleEveryN: 5,
        sampleCountRequired: 4,
      },
    },
    inspectedByUser: { name: "Inspector de prueba" },
    generalComments: "Inspeccion visual y dimensional",
    annotations: Array.from({ length: count }, (_, index) => ({
      label: String(index + 1),
      annotationType: "MEASUREMENT",
      measurement: {
        nominalValue: 2,
        unit: "in",
        result: index === count - 1 ? "FAIL" : "PASS",
        instrument: { id: "cal-1", code: "CAL-01", type: "Vernier", serialNumber: "123" },
        readings: Array.from({ length: readings }, (_, readingIndex) => ({
          value: 1.99 + readingIndex / 100,
          result: index === count - 1 && readingIndex === 0 ? "FAIL" : "PASS",
        })),
      },
    })),
  };
}

async function reportPages(model) {
  const buffer = await buildPdfBuffer(
    (doc) => drawQualityInspectionReportForm(doc, model),
    QUALITY_INSPECTION_PDF_OPTIONS
  );
  return analyzePdf(buffer).pages.map((page) =>
    textLines(page).map((line) => line.text).join(" ")
  );
}

test("reporte reproduce encabezados y campos del formato de inspeccion 2025", async () => {
  const model = buildInspectionReportModel(inspectionWithAnnotations(), null);
  assert.equal(model.workCode, "2610-6-A");
  assert.equal(model.pieceQuantity, "20");
  assert.equal(model.sampleSize, "4");
  assert.equal(model.frequency, "1 de cada 5");
  assert.equal(model.result, "NON_CONFORMING");

  const pages = await reportPages(model);
  assert.equal(pages.length, 1);
  const text = pages[0];
  for (const phrase of [
    "COM-CA-R-04",
    "Fecha de Revision: 03/03/2025",
    "Rev 1",
    "REPORTE DE INSPECCION DIMENSIONAL",
    "DATOS DE ENTRADA PLANO",
    "MEDICION",
    "Tolerancias Soldadura",
    "Tolerancia Maquinado",
    "Firma de produccion",
    "Firma de calidad",
    "No conforme",
    "1.99",
    "OK",
    "NO OK",
  ]) {
    assert.ok(text.includes(phrase), `Falta texto del formato: ${phrase}`);
  }
});

test("reporte pagina todas las lecturas e intervalos sin omitir datos", async () => {
  const model = buildInspectionReportModel(inspectionWithAnnotations(17, 5), null);
  const pages = await reportPages(model);
  assert.equal(pages.length, 4);
  assert.ok(pages[0].includes("PIEZA"));
  assert.ok(pages[1].includes("PIEZA"));
  assert.ok(pages[1].includes("2.03"));
  assert.ok(pages[2].includes("17"));
  assert.ok(pages[3].includes("17"));
});
