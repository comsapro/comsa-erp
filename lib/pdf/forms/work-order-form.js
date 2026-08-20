import { createIsoForm, FRAME } from "./iso-form.js";

// Formato controlado "ORDEN DE TRABAJO" COM-OT-R-001 (Revision 2, 9 de enero del 2025).
// Las coordenadas provienen del documento original entregado por calidad. Las secciones
// con cantidad variable de renglones (procesos, materiales y bloques de proceso) crecen
// hacia abajo respetando el mismo paso vertical del original.

const LABEL = { size: 9.75, bold: true };
const VALUE = { size: 9.75, bold: false };
const TITLE = { size: 11.25, bold: true };
const FOLIO = { size: 14.25, bold: true };

const HEADER = {
  cols: [28.5, 136.5, 376.5, 513, 583.5],
  labelX: 378.73,
  valueX: 515.31,
};

const PROJECT = {
  cols: [28.5, 107.25, 303],
  labelX: 30.75,
  valueX: 109.5,
  bandBottom: 668.25,
  rows: [642, 627, 612, 597, 570.75],
  bottom: 570.75,
};

const PROCESS_LIST = {
  left: 309.75,
  right: 583.5,
  textX: 311.62,
  bandBottom: 668.25,
  rowHeight: 15,
};

const MATERIAL = {
  cols: [28.5, 78.75, 141, 222.75, 335.25, 424.5, 495.75, 583.5],
  textX: [30.75, 81.23, 143.61, 225.34, 337.57, 426.74, 498.06],
  headers: ["Unidad", "Cantidad", "Descripción", "Dimensiones", "Presentación", "Proveedor", "¿Entregado?"],
  rowHeight: 15,
};

const BLOCK = {
  cols: [28.5, 129.75, 306, 407.25, 583.5],
  pitch: 131.25,
  firstTop: 384,
  nextPageTop: 762.75,
  height: 113.25,
  // Los parrafos legales y las firmas son texto fijo del formato: se colocan con la
  // abscisa exacta del original en lugar de recentrarlos, porque el ancho de Helvetica
  // no es identico al de la fuente con la que se emitio el machote.
  legalLeft: [
    { text: "Las dimensiones y características del trabajo realizado fueron", x: 32.34 },
    { text: "revisadas y aseguradas antes de dar por terminado el", x: 49.41 },
    { text: "procedimiento.", x: 133.96 },
  ],
  legalRight: [
    { text: "Estoy recibiendo el material descrito en esta orden de trabajo y", x: 310.5 },
    { text: "al firmar estoy aceptando las características del mismo.", x: 326.78 },
  ],
  signature: "_______________________",
  signatureX: { left: 103.57, right: 384.45 },
  captionX: { left: 124.75, right: 385.3 },
};

const FOOTER_LINES = ["Revisión 2", "Fecha de revisión: 9 de enero del 2025", "COM-OT-R-001"];

function drawHeader(form, model) {
  const [x0, x1, x2, x3, x4] = HEADER.cols;
  form.hLine(762.75, x0, x4 + 0.75);
  form.hLine(745.5, x2 + 0.75, x4 + 0.75);
  form.hLine(728.25, x2 + 0.75, x4 + 0.75);
  form.hLine(711, x0, x1 + 0.75);
  form.hLine(711, x2 + 0.75, x4 + 0.75);
  form.hLine(696, x0, x4 + 0.75);
  form.vLine(x0, 696, 763.5);
  form.vLine(x1, 696, 763.5);
  form.vLine(x2, 696, 763.5);
  form.vLine(x3, 696, 728.25);
  form.vLine(x4, 696, 763.5);

  form.image(model.logoPath, x0 + 5, 715, x1 - x0 - 10, 44);

  form.centered(model.title, x1, x2, 726, TITLE);
  form.centered("Hoja Blanca", x0, x1, 700.5, LABEL);

  form.text("Código de trabajo", HEADER.labelX, 752.25, LABEL);
  form.text(model.workCode, HEADER.labelX, 733.5, FOLIO);
  form.text("Fecha de solicitud", HEADER.labelX, 717.75, LABEL);
  form.text(model.requestDate, HEADER.valueX, 717.75, VALUE);
  form.text("Fecha Final Esperada", HEADER.labelX, 700.5, LABEL);
  form.text(model.expectedDate, HEADER.valueX, 700.5, VALUE);
}

function drawProjectTable(form, model) {
  const [x0, x1, x2] = PROJECT.cols;
  form.hLine(683.25, x0, x2 + 0.75);
  form.hLine(PROJECT.bandBottom, x0, x2 + 0.75);
  form.vLine(x0, PROJECT.bandBottom, 684);
  form.vLine(x2, PROJECT.bandBottom, 684);
  form.centered("Datos del proyecto", x0, x2, 672.75, LABEL);

  for (const y of PROJECT.rows) form.hLine(y, x0, x2 + 0.75);
  for (const x of PROJECT.cols) form.vLine(x, PROJECT.bottom, PROJECT.bandBottom + 0.75);

  const valueWidth = x2 - x1 - 6;
  form.text("Nombre de la", PROJECT.labelX, 657.75, VALUE);
  form.text("pieza", PROJECT.labelX, 646.5, VALUE);
  form.text(form.clip(model.pieceName, valueWidth, VALUE), PROJECT.valueX, 657.75, VALUE);
  form.text("Vendedor", PROJECT.labelX, 631.5, VALUE);
  form.text(form.clip(model.seller, valueWidth, VALUE), PROJECT.valueX, 631.5, VALUE);
  form.text("Empresa", PROJECT.labelX, 616.5, VALUE);
  form.text(form.clip(model.company, valueWidth, VALUE), PROJECT.valueX, 616.5, VALUE);
  form.text("No. Piezas", PROJECT.labelX, 601.5, VALUE);
  form.text(model.quantity, PROJECT.valueX, 601.5, VALUE);
  form.text("La pieza se", PROJECT.labelX, 586.5, VALUE);
  form.text("fabrica contra", PROJECT.labelX, 575.25, VALUE);

  const options = [
    { box: 109.5, label: " Muestra", labelX: 117.75 },
    { box: 163.81, label: " Plano", labelX: 172.06 },
    { box: 207.83, label: " Indicaciones", labelX: 216.08 },
  ];
  for (const option of options) {
    form.checkbox(option.box, 586.5);
    form.text(option.label, option.labelX, 586.5, VALUE);
  }
}

function drawProcessList(form, model) {
  const { left, right, textX, bandBottom, rowHeight } = PROCESS_LIST;
  form.hLine(683.25, left, right + 0.75);
  form.hLine(bandBottom, left, right + 0.75);
  form.vLine(left, bandBottom, 684);
  form.vLine(right, bandBottom, 684);
  form.centered("Procesos", left, right, 672.75, LABEL);

  const names = model.processNames.length ? model.processNames : [""];
  let bottom = bandBottom;
  for (const name of names) {
    bottom -= rowHeight;
    form.hLine(bottom, left, right + 0.75);
    form.text(form.clip(name, right - left - 6, VALUE), textX, bottom + 4.5, VALUE);
  }

  bottom -= rowHeight;
  form.hLine(bottom, left, right + 0.75);
  form.centered("Observaciones del vendedor", left, right, bottom + 4.5, LABEL);

  const lines = form.wrap(model.observations, right - left - 6, VALUE);
  if (!lines.length) {
    bottom -= 3.75;
  } else {
    let baseline = bottom - 8;
    for (const line of lines) {
      form.text(line, textX, baseline, VALUE);
      baseline -= 11.25;
    }
    bottom = baseline - 1.75;
  }
  form.hLine(bottom, left, right + 0.75);
  form.vLine(left, bottom, bandBottom + 0.75);
  form.vLine(right, bottom, bandBottom + 0.75);
  return bottom;
}

function drawMaterials(form, model, titleBaseline) {
  const cols = MATERIAL.cols;
  const x0 = cols[0];
  const x4 = cols[cols.length - 1];
  form.centered("Liberación de material", x0, x4, titleBaseline, TITLE);

  const headerTop = titleBaseline - 13.5;
  const headerBottom = headerTop - MATERIAL.rowHeight;
  form.hLine(headerTop, x0, x4 + 0.75);
  form.hLine(headerBottom, x0, x4 + 0.75);
  for (const x of cols) form.vLine(x, headerBottom, headerTop + 0.75);
  MATERIAL.headers.forEach((header, index) => {
    form.text(header, MATERIAL.textX[index], headerBottom + 4.5, LABEL);
  });

  const rows = model.materials.length ? model.materials : [null];
  let bottom = headerBottom;
  for (const material of rows) {
    const rowTop = bottom;
    bottom -= MATERIAL.rowHeight;
    for (const x of cols) form.vLine(x, bottom, rowTop);
    if (material) {
      const baseline = bottom + 4.5;
      const cells = [
        material.unit,
        material.quantity,
        material.description,
        material.dimensions,
        material.presentation,
        material.supplier,
      ];
      cells.forEach((value, index) => {
        const maxWidth = cols[index + 1] - cols[index] - 5;
        form.text(form.clip(value, maxWidth, VALUE), MATERIAL.textX[index], baseline, VALUE);
      });
      form.checkbox(MATERIAL.textX[6], baseline);
      form.text(" Si ", MATERIAL.textX[6] + 8.25, baseline, VALUE);
      form.checkbox(MATERIAL.textX[6] + 27.75, baseline);
      form.text(" No", MATERIAL.textX[6] + 36, baseline, VALUE);
    }
  }
  form.hLine(bottom - 0.75, x0, x4 + 0.75);
  return bottom - 0.75;
}

function drawExtraMaterials(form, model, materialsBottom) {
  const x0 = 28.5;
  const x1 = 583.5;
  const bandTop = materialsBottom - 12.75;
  const bandBottom = bandTop - 15;
  form.hLine(bandTop, x0, x1 + 0.75);
  form.hLine(bandBottom, x0, x1 + 0.75);
  form.vLine(x0, bandBottom, bandTop + 0.75);
  form.vLine(x1, bandBottom, bandTop + 0.75);
  form.centered("Solicitud extraordinaria de material", x0, x1, bandBottom + 4.5, LABEL);

  const causeBottom = bandBottom - 48.75;
  form.hLine(causeBottom, x0, x1 + 0.75);
  form.vLine(x0, causeBottom, bandBottom);
  form.vLine(x1, causeBottom, bandBottom);
  form.text("Causa de la solicitud:", 30.75, bandBottom - 10.5, VALUE);

  let detailBaseline = bandBottom - 21.75;
  for (const extra of model.extraMaterials.slice(0, 3)) {
    form.text(form.clip(extra.summary, x1 - x0 - 8, VALUE), 30.75, detailBaseline, VALUE);
    detailBaseline -= 11.25;
  }

  let rowBottom = causeBottom;
  for (let index = 0; index < 3; index += 1) {
    const rowTop = rowBottom;
    rowBottom -= 15;
    form.hLine(rowBottom, x0, x1 + 0.75);
    form.vLine(x0, rowBottom, rowTop);
    form.vLine(x1, rowBottom, rowTop);
    form.text(`${index + 1}.`, 30.75, rowBottom + 4.5, VALUE);
    const reason = model.extraMaterials[index]?.reason;
    if (reason) form.text(form.clip(reason, x1 - 50, VALUE), 45, rowBottom + 4.5, VALUE);
  }
  return rowBottom;
}

function drawProcessBlock(form, top, block) {
  const [c0, c1, c2, c3, c4] = BLOCK.cols;
  form.hLine(top, c0, c4 + 0.75);
  form.hLine(top - 15, c0, c4 + 0.75);
  form.hLine(top - 30, c0, c4 + 0.75);
  form.hLine(top - 45, c0, c4 + 0.75);
  form.vLine(c0, top - 45, top + 0.75);
  form.vLine(c4, top - 45, top + 0.75);
  form.vLine(c1, top - 45, top - 15);
  form.vLine(c2, top - 45, top - 15);
  form.vLine(c3, top - 45, top - 15);

  form.text(form.clip(block.name, c4 - c0 - 8, LABEL), 30.75, top - 10.5, LABEL);
  form.text("Fecha de inicio", 30.75, top - 25.5, VALUE);
  form.text(block.startDate, c1 + 2.25, top - 25.5, VALUE);
  form.text("Horas usadas", 308.25, top - 25.5, VALUE);
  form.text(block.hours, c3 + 2.25, top - 25.5, VALUE);
  form.text("Operador", 30.75, top - 40.5, VALUE);
  form.text(form.clip(block.operator, c2 - c1 - 6, VALUE), c1 + 2.25, top - 40.5, VALUE);
  form.text("Fecha de finalización", 308.25, top - 40.5, VALUE);
  form.text(block.endDate, c3 + 2.25, top - 40.5, VALUE);

  BLOCK.legalLeft.forEach((line, index) => {
    form.text(line.text, line.x, top - 57 - index * 11.25, VALUE);
  });
  BLOCK.legalRight.forEach((line, index) => {
    form.text(line.text, line.x, top - 57 - index * 11.25, VALUE);
  });
  form.text(BLOCK.signature, BLOCK.signatureX.left, top - 102, VALUE);
  form.text("Firma del operador", BLOCK.captionX.left, top - 113.25, VALUE);
  form.text(BLOCK.signature, BLOCK.signatureX.right, top - 90.75, VALUE);
  form.text("Firma del vendedor o cliente", BLOCK.captionX.right, top - 102, VALUE);
}

export function drawWorkOrderForm(doc, model) {
  const form = createIsoForm(doc);
  drawHeader(form, model);
  drawProjectTable(form, model);
  const processListBottom = drawProcessList(form, model);

  const flowBottom = Math.min(PROJECT.bottom, processListBottom);
  const materialsBottom = drawMaterials(form, model, flowBottom - 20.25);
  let top = drawExtraMaterials(form, model, materialsBottom) - 0.75;

  // El original arranca los bloques de proceso en 384 cuando la cabecera no crecio.
  top = Math.min(top, BLOCK.firstTop);

  for (const block of model.processes) {
    if (top - BLOCK.height < FRAME.bottom) {
      doc.addPage();
      top = BLOCK.nextPageTop;
    }
    drawProcessBlock(form, top, block);
    top -= BLOCK.pitch;
  }

  let footerBaseline = top + BLOCK.pitch - BLOCK.height - 26.25;
  if (!model.processes.length || footerBaseline - 22.5 < FRAME.bottom) {
    doc.addPage();
    footerBaseline = 752.25;
  }
  FOOTER_LINES.forEach((line, index) => {
    form.text(line, 28.5, footerBaseline - index * 11.25, VALUE);
  });
}
