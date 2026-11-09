import { createIsoForm, PDF_OPTIONS } from "./iso-form.js";

const LEFT = 28.5;
const RIGHT = 583.5;
const WIDTH = RIGHT - LEFT;
const BORDER = 0.75;
const LABEL = { size: 6.25, bold: true };
const SMALL = { size: 5.75, bold: false };
const SMALL_BOLD = { size: 5.75, bold: true };

const INFO_X = [LEFT, 166.5, 291, 418.5, RIGHT];
const TABLE_X = [
  LEFT,
  62.5,
  120.5,
  156,
  246,
  291,
  318,
  363,
  390,
  435,
  462,
  507,
  RIGHT,
];

function grid(form, xs, ys) {
  for (const y of ys) form.hLine(y, xs[0], xs[xs.length - 1] + BORDER);
  for (const x of xs) form.vLine(x, ys[ys.length - 1], ys[0] + BORDER);
}

function cell(form, value, x, top, width, { label, size = 7, maxLines = 1 } = {}) {
  const baseline = top - (label ? 8 : 10);
  if (label) form.text(label, x + 3, baseline, SMALL_BOLD);
  const lines = form.wrap(value || "-", width - 6, {
    size,
    bold: false,
  });
  lines.slice(0, maxLines).forEach((line, index) => {
    form.text(line, x + 3, baseline - (label ? 7 : 0) - index * (size + 1), {
      size,
      bold: false,
    });
  });
}

function drawHeader(form, model, pageNumber, pageCount) {
  const top = 763.5;
  const logoBottom = 690;
  const split = 162;
  form.hLine(top, LEFT, RIGHT + BORDER);
  form.hLine(logoBottom, LEFT, RIGHT + BORDER);
  form.vLine(LEFT, logoBottom, top + BORDER);
  form.vLine(split, logoBottom, top + BORDER);
  form.vLine(RIGHT, logoBottom, top + BORDER);
  form.image(model.logoPath, LEFT + 6, logoBottom + 5, split - LEFT - 12, 63);

  form.text("COM-CA-R-04", 470, 750, LABEL);
  form.text("Fecha de Revision: 03/03/2025", 470, 737, SMALL);
  form.text("Rev 1", 470, 725, SMALL);
  form.text("REPORTE DE INSPECCION DIMENSIONAL", split + 10, 704, {
    size: 11,
    bold: true,
  });
  if (pageCount > 1) {
    form.text(`Continuacion ${pageNumber} de ${pageCount}`, split + 10, 691, SMALL);
  }
}

function drawInspectionInfo(form, model, top = 690) {
  const rowHeights = [21, 21, 32];
  const ys = [top];
  rowHeights.forEach((height) => ys.push(ys[ys.length - 1] - height));
  grid(form, INFO_X, ys);

  const row1 = [
    ["Codigo de trabajo", model.workCode],
    ["Cantidad de piezas", model.pieceQuantity],
    ["Tamano de muestreo", model.sampleSize],
    ["Fecha de inspeccion", model.inspectionDate],
  ];
  row1.forEach((item, index) =>
    cell(form, item[1], INFO_X[index], ys[0], INFO_X[index + 1] - INFO_X[index], {
      label: item[0],
      size: 6.5,
    })
  );

  const row2 = [
    ["Cliente", model.client],
    ["Nombre del proyecto", model.projectName],
    ["Frecuencia", model.frequency],
    ["Inspector de calidad", model.inspector],
  ];
  row2.forEach((item, index) =>
    cell(form, item[1], INFO_X[index], ys[1], INFO_X[index + 1] - INFO_X[index], {
      label: item[0],
      size: 6.5,
    })
  );

  cell(form, model.instruments || "No indicado", LEFT, ys[2], INFO_X[3] - LEFT, {
    label: "Instrumentos de medicion utilizados",
    size: 6.25,
    maxLines: 2,
  });
  cell(form, model.serialNumbers || "No indicado", INFO_X[3], ys[2], RIGHT - INFO_X[3], {
    label: "No. de serie",
    size: 6.25,
    maxLines: 2,
  });
  return ys[ys.length - 1];
}

function drawTableHeading(form, top) {
  const bandBottom = top - 15;
  const instructionBottom = bandBottom - 22;
  const headerBottom = instructionBottom - 25;
  form.hLine(top, LEFT, RIGHT + BORDER);
  form.hLine(bandBottom, LEFT, RIGHT + BORDER);
  form.vLine(LEFT, bandBottom, top + BORDER);
  form.vLine(TABLE_X[4], bandBottom, top + BORDER);
  form.vLine(RIGHT, bandBottom, top + BORDER);
  form.centered("DATOS DE ENTRADA PLANO", LEFT, TABLE_X[4], top - 10, SMALL_BOLD);
  form.centered("MEDICION", TABLE_X[4], RIGHT, top - 10, SMALL_BOLD);

  grid(form, [LEFT, RIGHT], [bandBottom, instructionBottom]);
  form.centered(
    "Señalar con un OK si la dimension revisada SI esta dentro de especificaciones.",
    LEFT,
    RIGHT,
    bandBottom - 14,
    { size: 5.5, bold: false }
  );
  form.centered(
    "Señalar con un NO OK si la dimension revisada NO esta dentro de especificaciones.",
    LEFT,
    RIGHT,
    bandBottom - 20,
    { size: 5.5, bold: false }
  );
  grid(form, TABLE_X, [instructionBottom, headerBottom]);
  const labels = [
    ["Intervalo", 0],
    ["Valor nominal", 1],
    ["Unidad", 2],
    ["Instrumento de medicion", 3],
  ];
  labels.forEach(([text, index]) =>
    form.centered(text, TABLE_X[index], TABLE_X[index + 1], instructionBottom - 16, SMALL_BOLD)
  );

  for (let sample = 0; sample < 4; sample += 1) {
    const column = 4 + sample * 2;
    form.centered(
      "PIEZA",
      TABLE_X[column],
      TABLE_X[column + 1],
      instructionBottom - 16,
      SMALL_BOLD
    );
    form.centered("OK / NO OK.", TABLE_X[column + 1], TABLE_X[column + 2], instructionBottom - 16, {
      size: 4.75,
      bold: true,
    });
  }
  return headerBottom;
}

function measurementRowText(row, sampleIndex) {
  const reading = row.readings[sampleIndex];
  if (!reading) return { value: "", result: "" };
  return {
    value: reading.value,
    result: reading.result === "PASS" ? "OK" : reading.result === "FAIL" ? "NO OK" : "",
  };
}

function drawMeasurementRows(form, rows, top, sampleStart, sampleEnd) {
  const rowHeight = 12.25;
  const values = rows.slice(0, 16);
  while (values.length < 16) values.push(null);
  for (let index = 0; index < values.length; index += 1) {
    const rowTop = top - index * rowHeight;
    const rowBottom = rowTop - rowHeight;
    grid(form, TABLE_X, [rowTop, rowBottom]);
    const row = values[index];
    if (!row) continue;
    const label = row.label || String(index + 1);
    const nominal = row.nominal;
    form.centered(label, TABLE_X[0], TABLE_X[1], rowTop - 8.25, SMALL);
    form.centered(nominal, TABLE_X[1], TABLE_X[2], rowTop - 8.25, SMALL);
    form.centered(row.unit, TABLE_X[2], TABLE_X[3], rowTop - 8.25, SMALL);
    form.text(form.clip(row.instrument || "", TABLE_X[4] - TABLE_X[3] - 6, SMALL), TABLE_X[3] + 3, rowTop - 8.25, SMALL);
    for (let sample = 0; sample < 4; sample += 1) {
      const sampleNumber = sampleStart + sample;
      const result = sampleNumber <= sampleEnd
        ? measurementRowText(row, sampleNumber - 1)
        : { value: "", result: "" };
      const column = 4 + sample * 2;
      form.centered(result.value, TABLE_X[column], TABLE_X[column + 1], rowTop - 8.25, SMALL);
      form.centered(result.result, TABLE_X[column + 1], TABLE_X[column + 2], rowTop - 8.25, {
        size: 5,
        bold: result.result !== "",
      });
    }
  }
  return top - values.length * rowHeight;
}

function drawToleranceCriteria(form, top) {
  const bottom = top - 56;
  const mid = LEFT + 212;
  const x = [LEFT, LEFT + 212, LEFT + 276, LEFT + 358, LEFT + 422, RIGHT];
  const ys = [
    top,
    top - 14,
    top - 26,
    top - 33.5,
    top - 41,
    top - 48.5,
    bottom,
  ];
  grid(form, x, ys);
  form.text("Criterio del resultado de inspeccion", LEFT + 4, top - 10, SMALL_BOLD);
  form.centered("Tolerancias en mm", mid, RIGHT, top - 10, SMALL_BOLD);
  form.centered("Tolerancias Soldadura", x[1], x[3], ys[1] - 8, SMALL_BOLD);
  form.centered("Tolerancia Maquinado", x[3], x[5], ys[1] - 8, SMALL_BOLD);

  const criteria = [
    ["x", "20", "x", "0.4"],
    ["x.x", "15", "x.x", "0.3"],
    ["x.xx", "10", "x.xx", "0.25"],
    ["x.xxx", "5", "x.xxx", "0.2"],
  ];
  criteria.forEach((row, index) => {
    const baseline = ys[index + 2] - 5.5;
    form.centered(row[0], x[1], x[2], baseline, SMALL);
    form.centered(row[1], x[2], x[3], baseline, SMALL);
    form.centered(row[2], x[3], x[4], baseline, SMALL);
    form.centered(row[3], x[4], x[5], baseline, SMALL);
  });
  return bottom;
}

function drawResultAndSignatures(form, model, top) {
  const resultBottom = top - 20;
  grid(form, [LEFT, RIGHT], [top, resultBottom]);
  form.text("Resultado de la inspeccion:", LEFT + 4, top - 13, SMALL_BOLD);
  form.text(
    `${model.result === "CONFORMING" ? "[X]" : "[ ]"} Conforme`,
    LEFT + 150,
    top - 13,
    SMALL
  );
  form.text(
    `${model.result === "NON_CONFORMING" ? "[X]" : "[ ]"} No conforme`,
    LEFT + 245,
    top - 13,
    SMALL
  );
  if (model.result === "PENDING") {
    form.text("Pendiente", RIGHT - 55, top - 13, SMALL_BOLD);
  }

  const criteriaBottom = drawToleranceCriteria(form, resultBottom);
  const noticeBottom = criteriaBottom - 16;
  grid(form, [LEFT, RIGHT], [criteriaBottom, noticeBottom]);
  form.text(
    "En caso de que el plano no especifique tolerancias se tomaran las tolerancias anteriores.",
    LEFT + 4,
    criteriaBottom - 10,
    SMALL
  );

  const releaseBottom = noticeBottom - 31;
  grid(form, [LEFT, RIGHT], [noticeBottom, releaseBottom]);
  form.text(
    "En caso de que la pieza no cumpla con las especificaciones solicitadas por el cliente,",
    LEFT + 4,
    noticeBottom - 10,
    SMALL
  );
  form.text("la liberacion de esta pieza esta solicitada por:", LEFT + 4, noticeBottom - 20, SMALL);
  form.checkbox(RIGHT - 140, noticeBottom - 20, 7);
  form.text("Liberacion de producto conforme", RIGHT - 128, noticeBottom - 20, SMALL);

  const signaturesBottom = releaseBottom - 43;
  const sigX = [LEFT, LEFT + WIDTH / 3, LEFT + (WIDTH * 2) / 3, RIGHT];
  grid(form, sigX, [releaseBottom, signaturesBottom]);
  const signatureLabels = [
    "Nombre y firma del responsable",
    "Firma de produccion",
    "Firma de calidad",
  ];
  signatureLabels.forEach((label, index) => {
    const x1 = sigX[index];
    const x2 = sigX[index + 1];
    form.centered(label, x1 + 3, x2 - 3, releaseBottom - 10, {
      size: 5.5,
      bold: true,
    });
    form.hLine(signaturesBottom + 10, x1 + 12, x2 - 12, 0.5);
  });

  const notes = model.notes || [];
  const wrappedNotes = notes.flatMap((note) =>
    form.wrap(note, WIDTH - 10, { size: 5.5, bold: false })
  );
  const commentsHeight = Math.min(88, Math.max(32, 19 + wrappedNotes.length * 7));
  const commentsBottom = signaturesBottom - commentsHeight;
  grid(form, [LEFT, RIGHT], [signaturesBottom, commentsBottom]);
  form.text("Observaciones:", LEFT + 4, signaturesBottom - 9, SMALL_BOLD);
  let baseline = signaturesBottom - 18;
  for (const line of wrappedNotes) {
    if (baseline < commentsBottom + 5) break;
    form.text(line, LEFT + 4, baseline, { size: 5.5, bold: false });
    baseline -= 7;
  }
  form.text(
    `Estatus: ${model.status}`,
    RIGHT - 100,
    commentsBottom + 7,
    { size: 5.5, bold: false }
  );
}

export function drawQualityInspectionReportForm(doc, model) {
  const form = createIsoForm(doc);
  const rows = model.rows || [];
  const pageSize = 16;
  const sampleCount = Math.max(1, Number(model.maxReadings) || 1);
  const samplePages = Math.ceil(sampleCount / 4);
  const rowPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageCount = samplePages * rowPages;
  let pageNumber = 0;

  for (let rowPage = 0; rowPage < rowPages; rowPage += 1) {
    const pageRows = rows.slice(rowPage * pageSize, (rowPage + 1) * pageSize);
    for (let samplePage = 0; samplePage < samplePages; samplePage += 1) {
      if (pageNumber > 0) doc.addPage(PDF_OPTIONS);
      pageNumber += 1;
      const sampleStart = samplePage * 4 + 1;
      const sampleEnd = Math.min(sampleStart + 3, sampleCount);
      drawHeader(form, model, pageNumber, pageCount);
      const infoBottom = drawInspectionInfo(form, model);
      const tableTop = infoBottom - 10;
      const rowsTop = drawTableHeading(form, tableTop);
      const tableBottom = drawMeasurementRows(form, pageRows, rowsTop, sampleStart, sampleEnd);
      drawResultAndSignatures(form, model, tableBottom - 3);
    }
  }
}

export { PDF_OPTIONS as QUALITY_INSPECTION_PDF_OPTIONS };
