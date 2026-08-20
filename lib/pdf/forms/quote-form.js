import { createIsoForm, FRAME } from "./iso-form.js";

// Formato controlado de cotizacion (Revision 1.1). Coordenadas medidas del machote
// entregado por calidad (carta, origen abajo-izquierda). No alterar la retícula.

const L = 28.5;
const R = 583.5;
const GAP = 6.75;
const ROW = 14.25;
const LABEL = { size: 6.75, bold: false };
const BOLD = { size: 6.75, bold: true };
const TITLE = { size: 12, bold: true };

const HEADER = { top: 762.75, bottom: 696, split: 141.75, textX: 144.97 };
const TITLE_H = 14.25;
const META = {
  cols: [28.5, 96, 450.75, 517.5, 583.5],
  labelX: [32.25, 453.75],
  valueX: [99, 520.5],
};
const ITEM = {
  cols: [28.5, 39.75, 311.25, 351, 399, 444.75, 493.5, 538.5, 583.5],
  textX: [32.25, 42.76, 314.44, 354.2, 402.21, 447.88, 496.7, 541.56],
  headerH: 29.25,
  rowH: 21.75,
};
const NOTE = { idx: 51, keyX: 37.86, textX: 54 };
const FOOT = { split: 306.75, height: 36, mid: 21.75 };

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
  form.centered(`COTIZACION #${model.folio}`, L, R, top - 9, BOLD);
  return bot;
}

function drawMeta(form, model, top) {
  const ys = [top, top - ROW, top - ROW * 2, top - ROW * 3];
  table(form, META.cols, ys);
  const rows = [
    ["Empresa", model.meta.empresa, "Requisición", model.meta.requisicion],
    ["Responsable", model.meta.responsable, "Emitida", model.meta.emitida],
    ["Atentamente", model.meta.atentamente, "Vigencia hasta", model.meta.vigenciaHasta],
  ];
  rows.forEach((cells, i) => {
    const baseline = ys[i] - 9;
    form.text(cells[0], META.labelX[0], baseline, LABEL);
    form.text(form.clip(cells[1], 340, LABEL), META.valueX[0], baseline, LABEL);
    form.text(cells[2], META.labelX[1], baseline, LABEL);
    form.text(form.clip(cells[3], 58, LABEL), META.valueX[1], baseline, LABEL);
  });
  return ys[3];
}

function drawItemHeader(form, top) {
  const bot = top - ITEM.headerH;
  table(form, ITEM.cols, [top, bot]);
  const x = ITEM.textX;
  form.text("#", x[0], top - 9, BOLD);
  form.text("Descripción", x[1], top - 9, BOLD);
  form.text("Tiempo", x[2], top - 9, BOLD);
  form.text("de", x[2], top - 16.5, BOLD);
  form.text("entrega", x[2], top - 24, BOLD);
  form.text("Comentarios", x[3], top - 9, BOLD);
  form.text("Precio", x[4], top - 9, BOLD);
  form.text("Unitario", x[4], top - 16.5, BOLD);
  form.text("Descuento", x[5], top - 9, BOLD);
  form.text("Cantidad", x[6], top - 9, BOLD);
  form.text("Importe", x[7], top - 9, BOLD);
  return bot;
}

function drawItemRow(form, top, item) {
  const bot = top - ITEM.rowH;
  table(form, ITEM.cols, [top, bot]);
  const x = ITEM.textX;
  const baseline = top - 9;
  const delivery = item.deliveryUnit
    ? `${item.deliveryRange}\n${item.deliveryUnit}`
    : item.deliveryRange || "";
  form.text(String(item.position ?? ""), x[0], baseline, LABEL);
  form.text(form.clip(item.description || "", 268, LABEL), x[1], baseline, LABEL);
  const deliveryLines = String(delivery).split("\n");
  form.text(deliveryLines[0] || "", x[2], baseline, LABEL);
  if (deliveryLines[1]) form.text(deliveryLines[1], x[2], baseline - 7.5, LABEL);
  form.text(form.clip(item.comments || "", 42, LABEL), x[3], baseline, LABEL);
  form.text(item.unitPrice || "", x[4], baseline, LABEL);
  form.text(item.discount || "", x[5], baseline, LABEL);
  form.text(item.quantity || "", x[6], baseline, LABEL);
  form.text(item.amount || "", x[7], baseline, LABEL);
  return bot;
}

function drawTotals(form, model, top) {
  const ys = [top, top - ROW, top - ROW * 2, top - ROW * 3];
  const xBanner = META.cols[2];
  form.hLine(ys[0], L, R + 0.75);
  form.hLine(ys[3], L, R + 0.75);
  form.hLine(ys[1], xBanner, R + 0.75);
  form.hLine(ys[2], xBanner, R + 0.75);
  form.vLine(L, ys[3], ys[0] + 0.75);
  form.vLine(xBanner, ys[3], ys[0] + 0.75);
  form.vLine(META.cols[3], ys[3], ys[0] + 0.75);
  form.vLine(R, ys[3], ys[0] + 0.75);

  form.centered(model.currencyBanner, L, xBanner, ys[0] - 23.25, LABEL);
  const lines = [
    ["Subtotal sin IVA", model.totals.subtotal],
    ["IVA", model.totals.tax],
    ["Total con IVA", model.totals.total],
  ];
  lines.forEach(([label, value], i) => {
    const baseline = ys[i] - 9;
    form.text(label, META.labelX[1], baseline, LABEL);
    form.text(value, META.valueX[1], baseline, LABEL);
  });
  return ys[3];
}

function drawKeyedSection(form, title, rows, top) {
  const headerBot = top - ROW;
  table(form, [L, R], [top, headerBot]);
  form.centered(title, L, R, top - 9, BOLD);
  let y = headerBot;
  for (const row of rows) {
    const bot = y - ROW;
    table(form, [L, NOTE.idx, R], [y, bot]);
    form.text(row.key, NOTE.keyX, y - 9, LABEL);
    form.text(form.clip(row.text, 520, LABEL), NOTE.textX, y - 9, LABEL);
    y = bot;
  }
  return y;
}

function drawFooter(form, model, top) {
  const bot = top - FOOT.height;
  const mid = top - FOOT.mid;
  form.hLine(top, L, R + 0.75);
  form.hLine(bot, L, R + 0.75);
  form.hLine(mid, FOOT.split, R + 0.75);
  form.vLine(L, bot, top + 0.75);
  form.vLine(FOOT.split, bot, top + 0.75);
  form.vLine(R, bot, top + 0.75);

  form.centered(
    "En caso de vernos favorecidos con su pedido por favor dirigirlo a:",
    L,
    FOOT.split,
    top - 20.25,
    LABEL
  );
  form.text(model.company.footerName, FOOT.split + 3, top - 9, LABEL);
  if (model.company.email) {
    form.text(`E-mail: ${model.company.email}`, FOOT.split + 3, top - 16.5, LABEL);
  }
  if (model.company.rfc) {
    form.text(`RFC :${model.company.rfc}`, FOOT.split + 3, bot + 5.25, LABEL);
  }
  return bot;
}

export function drawQuoteForm(doc, model) {
  const form = createIsoForm(doc);

  let y = drawHeader(form, model);
  y = drawTitle(form, model, y - GAP);
  y = drawMeta(form, model, y);

  const items = model.items.length
    ? model.items
    : [{ position: "", description: "", deliveryRange: "", deliveryUnit: "", comments: "", unitPrice: "", discount: "", quantity: "", amount: "" }];

  y = drawItemHeader(form, y - GAP);
  for (const item of items) {
    if (y - ITEM.rowH < FRAME.bottom + 90) {
      doc.addPage();
      y = drawItemHeader(form, FRAME.top - GAP);
    }
    y = drawItemRow(form, y, item);
  }

  const blockH = ROW * 3 + GAP + ROW * (1 + model.notes.length) + GAP + ROW * (1 + model.cancellation.length) + GAP + FOOT.height + 20;
  if (y - GAP - blockH < FRAME.bottom) {
    doc.addPage();
    y = FRAME.top;
  }

  y = drawTotals(form, model, y - GAP);
  y = drawKeyedSection(
    form,
    "NOTAS",
    model.notes.map((text, i) => ({ key: String(i + 1), text })),
    y - GAP
  );
  y = drawKeyedSection(form, "CANCELACION O CAMBIO", model.cancellation, y - GAP);
  y = drawFooter(form, model, y - GAP);
  form.text(model.revisionLabel, L, y - 12, LABEL);
}
