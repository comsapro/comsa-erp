import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDimensionalControlModel,
  buildWorkOrderModel,
  drawDimensionalControl,
  drawWorkOrder,
  PDF_OPTIONS,
} from "../lib/pdf/production-docs.js";
import { operatorNames } from "../domains/production/process-rules.js";
import {
  PRODUCTION_REOPEN_REASON_CODES,
  reopenReasonText,
} from "../domains/production/constants.js";
import { uncompleteItemSchema, reopenItemSchema } from "../domains/production/schemas.js";
import { buildPdfBuffer } from "../lib/pdf/helpers.js";
import { analyzePdf, textLines } from "../scripts/dev/pdf-layout.mjs";
import { compareIsoForms, TOLERANCE } from "../scripts/dev/iso-form-compare.mjs";
import { SYSTEM_ROLES, ALL_PERMISSION_CODES } from "../lib/permissions/catalog.js";

const ORDER = {
  folio: "2608-13",
  sourceType: "QUOTE",
  approvalDate: "2026-08-06T00:00:00.000Z",
  client: { commercialName: "SIGRAMA" },
  quote: { folio: "COT-100", requestDate: "2026-08-04T00:00:00.000Z", seller: { name: "JALIL GIBRAN" } },
};

const ITEM = {
  position: 1,
  description: "11-E-9851-02",
  quantity: 530,
  startedAt: "2026-08-06T00:00:00.000Z",
  completedAt: null,
  commitmentDate: "2026-08-20T00:00:00.000Z",
  sellerObservations: "Doblez a 90 grados",
  operators: ["ANA", "LUIS", "MARIO", "ROSA", "PEDRO"],
  sourceMaterials: [
    {
      unit: "PZA",
      quantity: 1,
      descriptionSnapshot: "A-36",
      dimensions: "cal 12 (2,436cm2)",
      presentation: "LAMINA",
      supplierName: "SESMA",
    },
  ],
  extraMaterials: [
    { description: "Solera", quantity: 2, unit: "PZA", supplier: { name: "SESMA" }, reason: "Faltante en almacen" },
  ],
  processes: [
    { processNameSnapshot: "CORTE LASER", status: "COMPLETED", sourceType: "QUOTE", realHours: 2 },
    { processNameSnapshot: "Doblez", status: "IN_PROGRESS", sourceType: "QUOTE" },
    { processNameSnapshot: "Rectificado", status: "PENDING", sourceType: "PRODUCTION" },
    { processNameSnapshot: "Proceso reemplazado", status: "REPLACED", sourceType: "QUOTE" },
  ],
};

function pdfTexts(buffer) {
  const analysis = analyzePdf(buffer);
  return {
    pages: analysis.pages.length,
    lines: analysis.pages.flatMap((page) => textLines(page).map((line) => line.text)),
  };
}

// Los bloques de la izquierda y la derecha comparten linea base, asi que se cuentan las
// apariciones de la etiqueta y no los renglones.
function countLabel(lines, label) {
  return lines.reduce((total, line) => total + line.split(label).length - 1, 0);
}

test("Operadores del control dimensional: sin duplicados y maximo cuatro", () => {
  const names = operatorNames(
    {
      assignedToUser: { name: "ANA" },
      completedByUser: { name: "ROSA" },
      processes: [
        { status: "PENDING", assignedToUser: { name: "ANA" } },
        { status: "PENDING", assignedToUser: { name: "LUIS" } },
        { status: "REPLACED", assignedToUser: { name: "IGNORADO" } },
      ],
    },
    ["LUIS", "MARIO", "PEDRO"]
  );
  assert.deepEqual(names, ["ANA", "LUIS", "MARIO", "PEDRO"]);
});

test("Control dimensional lleva la cantidad dentro del nombre de la pieza", () => {
  const model = buildDimensionalControlModel(ORDER, ITEM);
  assert.equal(model.pieceName, "11-E-9851-02 (530 pz)");
  assert.equal(model.workCode, "2608-13");
  assert.equal(model.client, "SIGRAMA");
  assert.equal(model.startDate, "2026-08-06");
  assert.equal(model.operators.length, 4);
});

test("Orden de trabajo sin QR, prioridad ni responsable y con material completo", () => {
  const model = buildWorkOrderModel(ORDER, ITEM);
  for (const forbidden of ["qr", "qrDataUrl", "priority", "responsible", "quotedHours", "expectedHours"]) {
    assert.equal(forbidden in model, false, `el modelo no debe exponer ${forbidden}`);
  }
  assert.equal(model.title, "ORDEN DE TRABAJO COTIZADO");
  assert.equal(model.quantity, "530.00");
  assert.deepEqual(model.materials[0], {
    unit: "PZA",
    quantity: "1.00",
    description: "A-36",
    dimensions: "cal 12 (2,436cm2)",
    presentation: "LAMINA",
    supplier: "SESMA",
  });
  assert.equal(model.extraMaterials[0].reason, "Faltante en almacen");
  assert.equal(model.observations, "Doblez a 90 grados");
});

test("Un bloque de proceso por proceso activo, incluidos los agregados en piso", () => {
  const model = buildWorkOrderModel(ORDER, ITEM);
  assert.deepEqual(model.processNames, ["CORTE LASER", "Doblez", "Rectificado"]);
  assert.equal(model.processes.length, 3);
  assert.equal(model.processes[0].hours, "2");
});

test("Orden directa pierde la palabra COTIZADO del titulo", () => {
  const model = buildWorkOrderModel(
    { ...ORDER, sourceType: "DIRECT_ORDER", quote: null, directOrder: { seller: { name: "MARIA" } } },
    ITEM
  );
  assert.equal(model.title, "ORDEN DE TRABAJO");
  assert.equal(model.seller, "MARIA");
});

test("El control dimensional imprime ocho bloques de pieza en blanco", async () => {
  const model = buildDimensionalControlModel(ORDER, ITEM);
  const buffer = await buildPdfBuffer((doc) => drawDimensionalControl(doc, model), PDF_OPTIONS);
  assert.ok(Buffer.isBuffer(buffer) && buffer.length > 0);
  const { pages, lines } = pdfTexts(buffer);
  assert.equal(pages, 2);
  assert.equal(countLabel(lines, "PIEZA____"), 8);
  assert.equal(countLabel(lines, "REVISO OPERADOR NUM____"), 8);
  assert.ok(lines.some((line) => line.includes("Revisión 1.1")));
  assert.ok(lines.some((line) => line.includes("FIRMA DEL SUPERVISOR DE CALIDAD")));
});

test("La orden de trabajo pagina un bloque por proceso y cierra con el pie controlado", async () => {
  const many = {
    ...ITEM,
    processes: Array.from({ length: 8 }, (_, i) => ({
      processNameSnapshot: `Proceso ${i + 1}`,
      status: "PENDING",
      sourceType: "QUOTE",
    })),
  };
  const few = await buildPdfBuffer(
    (doc) => drawWorkOrder(doc, buildWorkOrderModel(ORDER, ITEM)),
    PDF_OPTIONS
  );
  const lots = await buildPdfBuffer(
    (doc) => drawWorkOrder(doc, buildWorkOrderModel(ORDER, many)),
    PDF_OPTIONS
  );
  const fewPdf = pdfTexts(few);
  const lotsPdf = pdfTexts(lots);
  assert.equal(fewPdf.pages, 2);
  assert.equal(lotsPdf.pages, 3);
  for (const pdf of [fewPdf, lotsPdf]) {
    assert.ok(pdf.lines.some((line) => line.includes("COM-OT-R-001")));
    assert.equal(
      pdf.lines.some((line) => /prioridad|responsable|horas cotizadas/i.test(line)),
      false
    );
  }
  assert.equal(countLabel(lotsPdf.lines, "Firma del operador"), 8);
});

test("Los formatos generados coinciden con el machote ISO en texto y retícula", async () => {
  const { reports } = await compareIsoForms();
  for (const report of reports) {
    assert.equal(report.pages.generated, report.pages.reference, `${report.name}: paginas`);
    assert.deepEqual(report.textMismatch, [], `${report.name}: textos sin coincidencia`);
    assert.deepEqual(report.textShift, [], `${report.name}: textos desplazados`);
    assert.deepEqual(report.sizeMismatch, [], `${report.name}: tamanos distintos`);
    assert.deepEqual(report.missingH, [], `${report.name}: bordes horizontales faltantes`);
    assert.deepEqual(report.missingV, [], `${report.name}: bordes verticales faltantes`);
    assert.ok(report.maxTextDx <= TOLERANCE, `${report.name}: dx=${report.maxTextDx}`);
    assert.ok(report.maxTextDy <= TOLERANCE, `${report.name}: dy=${report.maxTextDy}`);
  }
});

test("Catalogo de motivos para deshacer terminado o regresar a fabricacion", () => {
  assert.deepEqual(PRODUCTION_REOPEN_REASON_CODES, [
    "RECHAZO_CLIENTE",
    "ERROR_PIEZA",
    "CAMBIO_ALCANCE",
    "CAPTURA_ERRONEA",
    "OTRO",
  ]);
  assert.equal(reopenReasonText("CAPTURA_ERRONEA"), "Terminado capturado por error");
  assert.equal(
    reopenReasonText("OTRO", "El cliente cambio el plano"),
    "Otro: El cliente cambio el plano"
  );
});

test("Deshacer terminado y regreso a fabricacion exigen motivo del catalogo", () => {
  for (const schema of [uncompleteItemSchema, reopenItemSchema]) {
    assert.equal(schema.safeParse({}).success, false);
    assert.equal(schema.safeParse({ reasonCode: "INVENTADO" }).success, false);
    assert.equal(schema.safeParse({ reasonCode: "CAPTURA_ERRONEA" }).success, true);
    // "Otro" no puede quedar sin explicacion porque no se puede reportar por causa.
    assert.equal(schema.safeParse({ reasonCode: "OTRO" }).success, false);
    assert.equal(schema.safeParse({ reasonCode: "OTRO", reason: "corto" }).success, false);
    const parsed = schema.safeParse({
      reasonCode: "OTRO",
      reason: "El cliente cambio el plano",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.reason, "El cliente cambio el plano");
  }
});

test("Produccion puede agregar procesos no cotizados sin administrarlos", () => {
  assert.ok(ALL_PERMISSION_CODES.includes("production.add_process"));
  const produccion = SYSTEM_ROLES.find((role) => role.name === "Produccion");
  assert.ok(produccion, "el rol Produccion debe existir");
  assert.ok(produccion.permissions.includes("production.add_process"));
  assert.equal(produccion.permissions.includes("production.manage_processes"), false);
});
