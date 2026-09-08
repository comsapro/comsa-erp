import { createIsoForm, FRAME } from "./iso-form.js";

// Formato controlado COM-ALM-R-01 (Revision 1.1). Coordenadas medidas del machote
// de orden de compra (carta, origen abajo-izquierda). No alterar la retícula.

const L = 28.5;
const R = 583.5;
const GAP = 6.75;
const ROW = 14.25;
const LABEL = { size: 6.75, bold: false };
const BOLD = { size: 6.75, bold: true };
const TITLE = { size: 12, bold: true };
const INSTR_TITLE = { size: 7.5, bold: false };

const HEADER = { top: 762.75, bottom: 696, split: 141.75, textX: 144.97 };
const TITLE_H = 14.25;
const META = {
  cols: [28.5, 96, 284.25, 351, 583.5],
  labelX: [32.25, 287.45],
  valueX: [99, 354.2],
};
const ADDR = { cols: [28.5, 284.25, 583.5], height: 29.25 };
const ITEM = {
  cols: [28.5, 51, 118.5, 208.5, 293.25, 384, 450.75, 517.5, 583.5],
  textX: [32.25, 54, 121.75, 211.63, 296.16, 387, 453.75, 520.5],
  headerH: 14.25,
  rowH: 14.25,
};
const TOTALS = { split: 450.75, mid: 517.5 };
const SIGN = { split: 306.75, height: 66.75 };

function table(form, xs, ys) {
  const top = ys[0];
  const bot = ys[ys.length - 1];
  for (const y of ys) form.hLine(y, xs[0], xs[xs.length - 1] + 0.75);
  for (const x of xs) form.vLine(x, bot, top + 0.75);
}

function drawHeader(form, model) {
  const { top, bottom, split, textX } = HEADER;
  form.hLine(top, L, R + 0.75);
  form.hLine(bottom, L, R + 0.75);
  form.vLine(L, bottom, top + 0.75);
  form.vLine(split, bottom, top + 0.75);
  form.vLine(R, bottom, top + 0.75);
  form.image(model.logoPath, L + 4, bottom + 4, split - L - 8, top - bottom - 8);

  const company = model.company;
  form.text(company.legalName, textX, 750, TITLE);
  let y = 735.75;
  if (company.phone) {
    form.text(`Tel: ${company.phone}`, textX, y, LABEL);
    y -= 7.5;
  }
  if (company.cellPhone) {
    form.text(`Cel: ${company.cellPhone}`, textX, y, LABEL);
    y -= 7.5;
  }
  if (company.email) {
    form.text(company.email, textX, y, LABEL);
    y -= 7.5;
  }
  if (company.address) {
    form.text(company.address, textX, y, LABEL);
  }
  return bottom;
}

function drawTitle(form, model, top) {
  const bot = top - TITLE_H;
  table(form, [L, R], [top, bot]);
  form.centered(`ORDEN DE COMPRA #${model.folio}`, L, R, top - 9, BOLD);
  return bot;
}

function drawMeta(form, model, top) {
  const ys = [top, top - ROW, top - ROW * 2];
  table(form, META.cols, ys);
  const rows = [
    ["Proveedor", model.meta.proveedor, "Solicitante", model.meta.solicitante],
    ["Fecha", model.meta.fecha, "No. Cotizacion", model.meta.cotizacion],
  ];
  rows.forEach((cells, i) => {
    const baseline = ys[i] - 9;
    form.text(cells[0], META.labelX[0], baseline, LABEL);
    form.text(form.clip(cells[1], 180, LABEL), META.valueX[0], baseline, LABEL);
    form.text(cells[2], META.labelX[1], baseline, LABEL);
    form.text(form.clip(cells[3], 220, LABEL), META.valueX[1], baseline, LABEL);
  });
  return ys[2];
}

function drawAddress(form, model, top) {
  const bot = top - ADDR.height;
  table(form, ADDR.cols, [top, bot]);
  form.text("Dirección de envió o entrega:", META.labelX[0], top - 9, LABEL);
  form.text("Facturar a:", META.labelX[1], top - 9, LABEL);

  const leftWidth = ADDR.cols[1] - META.labelX[0] - 4;
  const rightWidth = R - META.labelX[1] - 4;
  const delivery = model.deliveryLines?.length
    ? model.deliveryLines
    : form.wrap(model.deliveryAddress || "", leftWidth, LABEL);
  delivery.slice(0, 2).forEach((line, i) => {
    form.text(form.clip(line, leftWidth, LABEL), META.labelX[0], top - 16.5 - i * 7.5, LABEL);
  });
  const billLines = form.wrap(model.billTo || "", rightWidth, LABEL);
  billLines.slice(0, 2).forEach((line, i) => {
    form.text(form.clip(line, rightWidth, LABEL), META.labelX[1], top - 16.5 - i * 7.5, LABEL);
  });
  return bot;
}

function drawItemHeader(form, top) {
  const bot = top - ITEM.headerH;
  table(form, ITEM.cols, [top, bot]);
  const x = ITEM.textX;
  const baseline = top - 9;
  const headers = [
    "No.",
    "No. Parte",
    "Tipo Material",
    "Descripción",
    "Dimensiones",
    "Cant/Unid",
    "Precio/Unidad",
    "Subtotal",
  ];
  headers.forEach((label, i) => form.text(label, x[i], baseline, LABEL));
  return bot;
}

function drawItemRow(form, top, item) {
  const bot = top - ITEM.rowH;
  table(form, ITEM.cols, [top, bot]);
  const x = ITEM.textX;
  const baseline = top - 9;
  const widths = [16, 62, 84, 78, 84, 58, 62, 58];
  const values = [
    String(item.position ?? ""),
    item.partNumber || "",
    item.materialType || "",
    item.description || "",
    item.dimensions || "",
    item.quantity || "",
    item.unitPrice || "",
    item.subtotal || "",
  ];
  values.forEach((value, i) => {
    form.text(form.clip(value, widths[i], LABEL), x[i], baseline, LABEL);
  });
  return bot;
}

function drawTotals(form, model, top) {
  const ys = [top, top - ROW, top - ROW * 2, top - ROW * 3];
  form.hLine(ys[0], L, R + 0.75);
  form.hLine(ys[3], L, R + 0.75);
  form.hLine(ys[1], TOTALS.split, R + 0.75);
  form.hLine(ys[2], TOTALS.split, R + 0.75);
  form.vLine(L, ys[3], ys[0] + 0.75);
  form.vLine(TOTALS.split, ys[3], ys[0] + 0.75);
  form.vLine(TOTALS.mid, ys[3], ys[0] + 0.75);
  form.vLine(R, ys[3], ys[0] + 0.75);

  form.centered(model.currencyBanner, L, TOTALS.split, ys[0] - 23.25, LABEL);
  const lines = [
    ["Subtotal sin IVA", model.totals.subtotal],
    ["IVA", model.totals.tax],
    ["Total con IVA", model.totals.total],
  ];
  lines.forEach(([label, value], i) => {
    const baseline = ys[i] - 9;
    form.text(label, 453.75, baseline, LABEL);
    form.text(value, 520.5, baseline, LABEL);
  });
  return ys[3];
}

function drawNotes(form, model, top) {
  const noteLines = model.notes
    ? form.wrap(model.notes, R - L - 10, LABEL)
    : [""];
  const rows = Math.max(1, noteLines.length);
  const headerBot = top - ROW;
  table(form, [L, R], [top, headerBot]);
  form.centered("NOTAS", L, R, top - 9, BOLD);
  let y = headerBot;
  for (let i = 0; i < rows; i += 1) {
    const bot = y - ROW;
    table(form, [L, R], [y, bot]);
    if (noteLines[i]) {
      form.text(noteLines[i], 32.25, y - 9, LABEL);
    }
    y = bot;
  }
  return y;
}

function drawSignatures(form, top) {
  const bot = top - SIGN.height;
  form.hLine(top, L, R + 0.75);
  form.hLine(bot, L, R + 0.75);
  form.vLine(L, bot, top + 0.75);
  form.vLine(SIGN.split, bot, top + 0.75);
  form.vLine(R, bot, top + 0.75);
  form.centered(
    "FIRMA DE DIRECCION GENERAL O GERENTE DE COMPRAS",
    L,
    SIGN.split,
    bot + 5.5,
    LABEL
  );
  form.centered("SELLO DE COMSA", SIGN.split, R, bot + 5.5, LABEL);
  return bot;
}

function drawInstructions(form, model, top) {
  const instr = model.instructions;
  form.text(instr.title, L, top - 25.5, INSTR_TITLE);
  let y = top - 45;
  form.text(instr.intro, L, y, LABEL);
  y -= 13.5;
  instr.bullets.forEach((line, i) => {
    form.text(line, L, y, LABEL);
    y -= i === instr.bullets.length - 1 ? 13.5 : 7.5;
  });
  form.text(instr.closing, L, y, LABEL);
  y -= 13.5;
  form.text(model.revisionLabel, L, y, LABEL);
  y -= 7.5;
  form.text(model.revisionDate, L, y, LABEL);
  y -= 7.5;
  form.text(model.docCode, L, y, LABEL);
  return y;
}

export function drawPurchaseOrderForm(doc, model) {
  const form = createIsoForm(doc);

  const drawChrome = () => {
    let y = drawHeader(form, model);
    y = drawTitle(form, model, y - GAP);
    y = drawMeta(form, model, y);
    y = drawAddress(form, model, y);
    return y;
  };

  let y = drawChrome();
  const items = model.items.length
    ? model.items
    : [
        {
          position: "",
          partNumber: "",
          materialType: "",
          description: "",
          dimensions: "",
          quantity: "",
          unitPrice: "",
          subtotal: "",
        },
      ];

  y = drawItemHeader(form, y - GAP);
  for (const item of items) {
    if (y - ITEM.rowH < FRAME.bottom + 300) {
      doc.addPage();
      y = drawItemHeader(form, drawChrome() - GAP);
    }
    y = drawItemRow(form, y, item);
  }

  const footerH = ROW * 3 + GAP + ROW * 2 + GAP + SIGN.height + 150;
  if (y - GAP - footerH < FRAME.bottom) {
    doc.addPage();
    y = FRAME.top;
  }

  y = drawTotals(form, model, y - GAP);
  y = drawNotes(form, model, y - GAP);
  y = drawSignatures(form, y - GAP);
  drawInstructions(form, model, y);
}
