import { createIsoForm } from "./iso-form.js";

// Formato controlado "REGISTRO DE CONTROL DIMENSIONAL DURANTE EL PROCESO" (Revision 1.1).
// Las coordenadas provienen del documento original entregado por calidad y no deben
// cambiarse: el formato esta sujeto a control documental ISO.

const HEADER_COLS = [28.5, 177, 321.75, 468, 583.5];
const HEADER_TEXT_X = [32.25, 180.4, 325.64, 471.77];
const OPERATOR_COLS = [28.5, 213.75, 398.25, 583.5];

const BLOCK_TOPS = [595.5, 459, 322.5, 186];
const BLOCK_COLS = {
  left: [28.5, 96.75, 165.75, 234, 303],
  right: [309.75, 378, 446.25, 515.25, 583.5],
};
const BLOCK_TEXT_X = {
  left: [32.25, 100.78, 169.31, 237.84],
  right: [313.12, 381.66, 450.19, 518.72],
};
// Desplazamientos verticales de cada linea del bloque respecto a su borde superior.
const BLOCK_ROW_OFFSETS = [0, -14.25, -30, -44.25, -58.5, -72.75, -87, -101.25, -115.5, -129.75];
const BLOCK_BASELINES = {
  header: -9,
  subheader: -23.25,
  marks: -24.75,
  measures: [-39, -53.25, -67.5, -81.75, -96],
  instrument: -110.25,
  serial: -124.5,
};

const LABEL = { size: 6.75, bold: true };
const VALUE = { size: 6.75, bold: false };
const NOTICE = { size: 9, bold: true };

function drawHeaderTable(form, model) {
  const [x0, x1, x2, x3, x4] = HEADER_COLS;
  form.hLine(762.75, x0, x4 + 0.75);
  form.hLine(747, x1 + 0.75, x4 + 0.75);
  form.hLine(732.75, x1 + 0.75, x4 + 0.75);
  form.hLine(718.5, x1 + 0.75, x2 + 0.75);
  form.hLine(718.5, x3 + 0.75, x4 + 0.75);
  form.hLine(704.25, x1 + 0.75, x2);
  form.hLine(704.25, x3 + 0.75, x4 + 0.75);
  form.hLine(690, x0, x4 + 0.75);
  form.vLine(x0, 690, 763.5);
  form.vLine(x1, 690, 763.5);
  form.vLine(x2, 690, 747);
  form.vLine(x3, 690, 747);
  form.vLine(x4, 690, 763.5);

  form.text("REGISTRO DE CONTROL DIMENSIONAL DURANTE EL PROCESO", HEADER_TEXT_X[1], 752.25, NOTICE);

  form.text("CODIGO DE TRABAJO", HEADER_TEXT_X[1], 738, LABEL);
  form.text("NOMBRE DE LA PIEZA", HEADER_TEXT_X[2], 738, LABEL);
  form.text("FECHA DE INICIO", HEADER_TEXT_X[3], 738, LABEL);
  form.text("CLIENTE", HEADER_TEXT_X[1], 709.5, LABEL);
  form.text("FECHA FINAL", HEADER_TEXT_X[3], 709.5, LABEL);

  form.text(form.clip(model.workCode, x2 - x1 - 6, VALUE), HEADER_TEXT_X[1], 723.75, VALUE);
  form.text(form.clip(model.pieceName, x3 - x2 - 6, VALUE), HEADER_TEXT_X[2], 723.75, VALUE);
  form.text(form.clip(model.startDate, x4 - x3 - 6, VALUE), HEADER_TEXT_X[3], 723.75, VALUE);
  form.text(form.clip(model.client, x2 - x1 - 6, VALUE), HEADER_TEXT_X[1], 695.25, VALUE);
  form.text(form.clip(model.endDate, x4 - x3 - 6, VALUE), HEADER_TEXT_X[3], 695.25, VALUE);

  // El logotipo va en la celda superior izquierda del encabezado, no junto a operadores.
  form.image(model.logoPath, x0 + 4, 696, x1 - x0 - 8, 62);
}

function drawOperatorsTable(form, model) {
  const [x0, x1, x2, x3] = OPERATOR_COLS;
  form.hLine(683.25, x0, x3 + 0.75);
  form.hLine(669, x0, x2 + 0.75);
  form.hLine(654.75, x0, x2 + 0.75);
  form.hLine(640.5, x0, x2 + 0.75);
  form.hLine(626.25, x0, x3 + 0.75);
  for (const x of OPERATOR_COLS) form.vLine(x, 626.25, 684);

  const baselines = [674.25, 660, 645.75, 631.5];
  baselines.forEach((baseline, index) => {
    form.text(`NOMBRE DEL OPERADOR ${index + 1}`, 32.25, baseline, VALUE);
    const operator = model.operators?.[index];
    if (operator) form.text(form.clip(operator, x2 - x1 - 8, VALUE), 217.24, baseline, VALUE);
  });

  // En el machote esta celda lleva la etiqueta fija "IMG", reservada para anexos impresos.
  form.text("IMG", x2 + 4, 674.25, VALUE);
}

// El aviso es texto fijo del formato (incluida la separacion "NO ES PECIFICAR" del
// original) y se coloca con la abscisa exacta del machote.
function drawNotice(form) {
  form.text(
    "EN CASO DE NO ES PECIFICAR MEDIDAS CRITICAS SOLO MEDIR ANCHO ALTO Y LARGO TOMANDO COMO TOLERANCIAS",
    37.93,
    612.75,
    NOTICE
  );
  form.text("LAS INDICADAS EN EL PLANO", 239.7, 603.75, NOTICE);
}

function drawMeasurementBlock(form, top, side) {
  const cols = BLOCK_COLS[side];
  const tx = BLOCK_TEXT_X[side];
  const [c0, c1, c2, c3, c4] = cols;

  for (const offset of BLOCK_ROW_OFFSETS) {
    form.hLine(top + offset, c0, c4 + 0.75);
  }
  form.vLine(c0, top + BLOCK_ROW_OFFSETS[9], top + 0.75);
  // c1/c3 solo en filas de medicion; instrumento/serie dejan c0+c1 como etiqueta ancha.
  form.vLine(c1, top + BLOCK_ROW_OFFSETS[7], top + BLOCK_ROW_OFFSETS[1]);
  form.vLine(c1, top + BLOCK_ROW_OFFSETS[1], top + 0.75);
  form.vLine(c2, top + BLOCK_ROW_OFFSETS[9], top + BLOCK_ROW_OFFSETS[1]);
  form.vLine(c3, top + BLOCK_ROW_OFFSETS[7], top + BLOCK_ROW_OFFSETS[1]);
  form.vLine(c4, top + BLOCK_ROW_OFFSETS[9], top + 0.75);

  form.text("PIEZA____", tx[0], top + BLOCK_BASELINES.header, LABEL);
  form.text("REVISO OPERADOR NUM____", tx[1], top + BLOCK_BASELINES.header, LABEL);

  form.text("Cota", tx[1], top + BLOCK_BASELINES.subheader, LABEL);
  form.text("Medición", tx[2], top + BLOCK_BASELINES.subheader, LABEL);
  const marksBaseline = top + BLOCK_BASELINES.marks;
  form.checkMark(tx[3], marksBaseline);
  form.text(" / ", tx[3] + 5.06, marksBaseline, LABEL);
  form.crossMark(tx[3] + 10.69, marksBaseline);

  BLOCK_BASELINES.measures.forEach((offset, index) => {
    form.text(String(index + 1), tx[0], top + offset, VALUE);
  });

  form.text("INSTRUMENTO DE MEDICION", tx[0], top + BLOCK_BASELINES.instrument, LABEL);
  form.text("NUM. DE SERIE", tx[0], top + BLOCK_BASELINES.serial, LABEL);
}

function drawObservations(form) {
  form.hLine(49.5, 28.5, 584.25);
  form.vLine(28.5, 27.75, 50.25);
  form.vLine(583.5, 27.75, 50.25);
  form.text("OBSERVACIONES", 32.25, 40.5, LABEL);
}

function drawSignaturePage(form) {
  form.hLine(744.75, 28.5, 584.25);
  form.vLine(28.5, 744.75, 763.5);
  form.vLine(583.5, 744.75, 763.5);
  form.centered("FIRMA DEL SUPERVISOR DE CALIDAD", 28.5, 583.5, 750, VALUE);
  form.text("Revisión 1.1", 28.5, 732.75, VALUE);
}

export function drawDimensionalControlForm(doc, model) {
  const form = createIsoForm(doc);
  drawHeaderTable(form, model);
  drawOperatorsTable(form, model);
  drawNotice(form);
  for (const top of BLOCK_TOPS) {
    drawMeasurementBlock(form, top, "left");
    drawMeasurementBlock(form, top, "right");
  }
  drawObservations(form);
  doc.addPage();
  drawSignaturePage(form);
}
