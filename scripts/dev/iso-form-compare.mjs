// Compara los formatos controlados generados por el ERP contra los machotes de calidad
// versionados en public/templates/produccion: texto, linea base, abscisa, tamano de fuente
// y bordes de la retícula. Lo usan el script de verificacion y tests/produccion-formatos.
import path from "node:path";
import PDFDocument from "pdfkit";
import { analyzePdf, horizontalBorders, verticalBorders, textLines } from "./pdf-layout.mjs";
import { drawDimensionalControlForm } from "../../lib/pdf/forms/control-dimensional-form.js";
import { drawWorkOrderForm } from "../../lib/pdf/forms/work-order-form.js";
import { drawQuoteForm } from "../../lib/pdf/forms/quote-form.js";
import { PDF_OPTIONS } from "../../lib/pdf/forms/iso-form.js";

export const TOLERANCE = 1;

export const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates", "produccion");
export const QUOTE_TEMPLATE = path.join(process.cwd(), "public", "templates", "cotizaciones", "cotizacion.pdf");

export function buildFormBuffer(draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(PDF_OPTIONS);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      draw(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Datos equivalentes a los que trae impresos el machote entregado por calidad.
export const DIMENSIONAL_SAMPLE = {
  workCode: "2607-103-B",
  pieceName: "11-E-9851-02",
  client: "SIGRAMA",
  startDate: "2026-08-06",
  endDate: "",
  operators: [],
  logoPath: null,
};

export const WORK_ORDER_SAMPLE = {
  title: "ORDEN DE TRABAJO COTIZADO",
  workCode: "2608-13",
  requestDate: "2026-08-06",
  expectedDate: "",
  pieceName: "11-E-9851-02",
  seller: "JALIL GIBRAN",
  company: "SIGRAMA",
  quantity: "530.00",
  observations: "",
  processNames: ["CORTE LASER", "Doblez", "Centro de Maquinado CNC"],
  materials: [
    {
      unit: "PZA",
      quantity: "1.00",
      description: "A-36",
      dimensions: "cal 12 (2,436cm2)",
      presentation: "LAMINA",
      supplier: "SESMA",
    },
  ],
  extraMaterials: [],
  processes: ["CORTE LASER", "Doblez", "Centro de Maquinado CNC"].map((name) => ({
    name,
    startDate: "",
    endDate: "",
    hours: "",
    operator: "",
  })),
  logoPath: null,
};

export const QUOTE_SAMPLE = {
  folio: "2607-111-B",
  revisionLabel: "Revisión 1.1",
  currencyBanner: "PRECIOS EN PESOS MEXICANOS",
  company: {
    legalName: "COMERCIALIZADORA, OPERACIONES Y MANUFACTURA, S.A. DE C.V.",
    footerName: "COMERCIALIZADORA, OPERACIONES Y MANUFACTURA SA DE CV.",
    phone: "(871) 538 5508",
    cellPhone: "(871) 167 5229",
    email: "comsamaquinados@comsapro.com.mx",
    address: "Calle Lirios No. 43, Col, Ana Establo, C.P. 27405, Torreón, Coahuila.",
    rfc: "COM070417GW6",
  },
  meta: {
    empresa: "MONTIAC",
    requisicion: "-",
    responsable: "Ricardo Facusseh",
    emitida: "2026-07-15",
    atentamente: "JALIL GIBRAN",
    vigenciaHasta: "2026-08-14",
  },
  items: [
    {
      position: 1,
      description: "FORD_V63+MG+008+CENTRADOR_CORAZON_+RDI_+M00+250619_RF+MTC",
      deliveryRange: "2 A 4",
      deliveryUnit: "SEMANAS",
      comments: "",
      unitPrice: "$2,592.50",
      discount: "$0.00",
      quantity: "1.00",
      amount: "$2,592.50",
    },
    {
      position: 2,
      description: "FORD_V63+MG+010+CENTRADOR_Y_+RDI_+M00+250619_RF+MTC",
      deliveryRange: "2 A 4",
      deliveryUnit: "SEMANAS",
      comments: "",
      unitPrice: "$2,649.70",
      discount: "$0.00",
      quantity: "1.00",
      amount: "$2,649.70",
    },
    {
      position: 3,
      description: "FORD_V63+MG+011+DOWEL_CENTRADOR_LARGO_+RDI_+M00+250619_RF+MTC",
      deliveryRange: "2 A 4",
      deliveryUnit: "SEMANAS",
      comments: "",
      unitPrice: "$1,842.50",
      discount: "$0.00",
      quantity: "1.00",
      amount: "$1,842.50",
    },
  ],
  totals: { subtotal: "$7,084.70", tax: "$1,133.55", total: "$8,218.25" },
  notes: [
    "Condiciones de pago serán: pago del 100% a el crédito establecido.",
    "Se consideran días hábiles de lunes a viernes y quitando los días festivos.",
    "Antes de favorecernos con su PO confirmar el tiempo de entrega.",
  ],
  cancellation: [
    {
      key: "A",
      text: "En caso de cancelacion o cambio de la PO por una cantidad menor a la establecida originalmente se realizara un cargo del 50% del valor de la PO.",
    },
    {
      key: "B",
      text: "En caso de servicios estos se podran cancelar o cambiar de fecha hasta con 48 Horas antes de realizarse el servicio.",
    },
    {
      key: "C",
      text: 'En caso de que un servicio sea cancelado despues de lo establecido en el apartado "B" se realizara el cargo mencionado en el apartado "A".',
    },
  ],
  logoPath: null,
};

// El machote codifica casillas y marcas con una fuente de simbolos; el ERP las dibuja
// como vector, asi que se ignoran esos glifos al comparar cadenas.
function normalize(text) {
  return text
    .replace(/\[105\]/g, "á")
    .replace(/\[112\]/g, "é")
    .replace(/\[\d+\]/g, "")
    .replace(/[▢✓✕]/g, "")
    // El machote se imprimio sin el logotipo y dejo el texto alternativo "IMG" en la celda.
    .replace(/IMG/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compareTexts(reference, generated, label, report) {
  const pending = generated.slice();
  for (const line of reference) {
    const refText = normalize(line.text);
    if (!refText) continue;
    const index = pending.findIndex(
      (candidate) => normalize(candidate.text) === refText && Math.abs(candidate.y - line.y) <= TOLERANCE
    );
    if (index === -1) {
      const sameText = generated.find((candidate) => normalize(candidate.text) === refText);
      report.textMismatch.push({
        page: label,
        text: line.text,
        refY: line.y,
        refX: line.x,
        genY: sameText?.y ?? null,
        genX: sameText?.x ?? null,
      });
      continue;
    }
    const match = pending.splice(index, 1)[0];
    const dx = Math.abs(match.x - line.x);
    const dy = Math.abs(match.y - line.y);
    report.maxTextDx = Math.max(report.maxTextDx, dx);
    report.maxTextDy = Math.max(report.maxTextDy, dy);
    if (dx > TOLERANCE) {
      report.textShift.push({ page: label, text: line.text, refX: line.x, genX: match.x });
    }
    if (match.size !== line.size) {
      report.sizeMismatch.push({ page: label, text: line.text, refSize: line.size, genSize: match.size });
    }
  }
}

function compareBorders(reference, generated, label, report) {
  for (const border of reference) {
    const match = generated.find(
      (candidate) =>
        Math.abs(candidate.y - border.y) <= TOLERANCE &&
        candidate.x1 <= border.x1 + TOLERANCE &&
        candidate.x2 >= border.x2 - TOLERANCE
    );
    if (!match) report.missingH.push({ page: label, ...border });
  }
}

function compareVerticals(reference, generated, label, report) {
  for (const border of reference) {
    const match = generated.find(
      (candidate) =>
        Math.abs(candidate.x - border.x) <= TOLERANCE &&
        candidate.y1 <= border.y1 + TOLERANCE &&
        candidate.y2 >= border.y2 - TOLERANCE
    );
    if (!match) report.missingV.push({ page: label, ...border });
  }
}

export function compareDocuments(name, referencePath, generatedBuffer) {
  const reference = analyzePdf(referencePath);
  const generated = analyzePdf(generatedBuffer);
  const report = {
    name,
    pages: { reference: reference.pages.length, generated: generated.pages.length },
    maxTextDx: 0,
    maxTextDy: 0,
    textMismatch: [],
    textShift: [],
    sizeMismatch: [],
    missingH: [],
    missingV: [],
  };
  const pageCount = Math.min(reference.pages.length, generated.pages.length);
  for (let i = 0; i < pageCount; i += 1) {
    const label = `p${i + 1}`;
    compareTexts(textLines(reference.pages[i]), textLines(generated.pages[i]), label, report);
    compareBorders(horizontalBorders(reference.pages[i]), horizontalBorders(generated.pages[i]), label, report);
    compareVerticals(verticalBorders(reference.pages[i]), verticalBorders(generated.pages[i]), label, report);
  }
  return report;
}

export async function buildIsoSamples() {
  const [dimensional, workOrder, quote] = await Promise.all([
    buildFormBuffer((doc) => drawDimensionalControlForm(doc, DIMENSIONAL_SAMPLE)),
    buildFormBuffer((doc) => drawWorkOrderForm(doc, WORK_ORDER_SAMPLE)),
    buildFormBuffer((doc) => drawQuoteForm(doc, QUOTE_SAMPLE)),
  ]);
  return { dimensional, workOrder, quote };
}

export async function compareIsoForms() {
  const { dimensional, workOrder, quote } = await buildIsoSamples();
  return {
    buffers: { dimensional, workOrder, quote },
    reports: [
      compareDocuments(
        "control dimensional",
        path.join(TEMPLATES_DIR, "control_dimensional.pdf"),
        dimensional
      ),
      compareDocuments(
        "orden de trabajo",
        path.join(TEMPLATES_DIR, "orden_trabajo_cubopanel.pdf"),
        workOrder
      ),
      compareDocuments("cotizacion", QUOTE_TEMPLATE, quote),
    ],
  };
}
