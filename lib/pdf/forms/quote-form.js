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

const LINE_H = 7.5;
const FIRST_BASELINE = 9;
const ROW_BOTTOM_LIMIT = FRAME.bottom + 20;
export const COMMENTS_BELOW_LABEL = "Ver abajo";

function itemCellWidth(i) {
  return ITEM.cols[i + 1] - ITEM.textX[i] - 2.5;
}

/** Ajusta el texto al ancho de la celda respetando saltos de linea; corta palabras mas anchas que la celda. */
export function wrapCell(form, value, maxWidth) {
  const lines = [];
  for (const paragraph of String(value ?? "").split(/\r?\n/)) {
    for (const line of form.wrap(paragraph, maxWidth, LABEL)) {
      let rest = line;
      while (rest) {
        let n = rest.length;
        while (n > 1 && form.width(rest.slice(0, n), LABEL) > maxWidth) n -= 1;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n).trimStart();
      }
    }
  }
  return lines;
}

// Una fila de dos lineas mide exactamente ITEM.rowH, como en el machote.
const ROW_BOTTOM_PAD = ITEM.rowH - FIRST_BASELINE - LINE_H;

function rowHeight(lineCount) {
  return Math.max(ITEM.rowH, FIRST_BASELINE + (lineCount - 1) * LINE_H + ROW_BOTTOM_PAD);
}

/**
 * Dibuja una fila cuyas celdas crecen con su texto. Si no cabe en la pagina se parte:
 * lo que cabe queda aqui y el resto continua en la siguiente (onNewPage devuelve la nueva y).
 */
function drawGrowingRow(form, top, xs, cells, onNewPage) {
  let y = top;
  let remaining = cells.map((cell) => cell.lines);
  for (;;) {
    const need = Math.max(1, ...remaining.map((lines) => lines.length));
    const fits = (n) => y - rowHeight(n) >= ROW_BOTTOM_LIMIT;
    if (!fits(Math.min(need, 2))) y = onNewPage();
    let take = need;
    while (take > 1 && !fits(take)) take -= 1;

    const bot = y - rowHeight(take);
    table(form, xs, [y, bot]);
    cells.forEach((cell, i) => {
      remaining[i].slice(0, take).forEach((line, j) => {
        form.text(line, cell.x, y - FIRST_BASELINE - j * LINE_H, LABEL);
      });
    });
    remaining = remaining.map((lines) => lines.slice(take));
    y = bot;
    if (remaining.every((lines) => lines.length === 0)) return y;
    y = onNewPage();
  }
}

function drawItemRow(form, top, item, onNewPage) {
  const x = ITEM.textX;
  const delivery = [item.deliveryRange, item.deliveryUnit].filter(Boolean);
  const inlineComments = item.commentsBelow
    ? [COMMENTS_BELOW_LABEL]
    : wrapCell(form, item.comments, itemCellWidth(3));
  const one = (value) => (value ? [String(value)] : []);

  let y = drawGrowingRow(
    form,
    top,
    ITEM.cols,
    [
      { x: x[0], lines: one(item.position) },
      { x: x[1], lines: wrapCell(form, item.description, itemCellWidth(1)) },
      { x: x[2], lines: delivery },
      { x: x[3], lines: inlineComments },
      { x: x[4], lines: one(item.unitPrice) },
      { x: x[5], lines: one(item.discount) },
      { x: x[6], lines: one(item.quantity) },
      { x: x[7], lines: one(item.amount) },
    ],
    onNewPage
  );

  if (item.commentsBelow) {
    y = drawGrowingRow(
      form,
      y,
      [L, ITEM.cols[1], R],
      [
        {
          x: x[1],
          lines: wrapCell(form, `Comentarios: ${item.comments}`, R - x[1] - 3),
        },
      ],
      onNewPage
    );
  }
  return y;
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

  const newItemsPage = () => {
    doc.addPage();
    return drawItemHeader(form, FRAME.top - GAP);
  };

  y = drawItemHeader(form, y - GAP);
  for (const item of items) {
    if (y - ITEM.rowH < FRAME.bottom + 90) y = newItemsPage();
    y = drawItemRow(form, y, item, newItemsPage);
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
