import "server-only";
import fs from "fs";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf/helpers";
import {
  buildQuotePrintModel,
  getComsaLogoPath,
} from "@/domains/quotes/quote-print";

const MARGIN_X = 36;
const PAGE_RIGHT = 576;
const CONTENT_WIDTH = PAGE_RIGHT - MARGIN_X;
const PAGE_BOTTOM = 752;
const BORDER = "#000000";
const PAD = 3;

function strokeRect(doc, x, y, w, h) {
  doc.save();
  doc.lineWidth(0.7).strokeColor(BORDER).rect(x, y, w, h).stroke();
  doc.restore();
}

function ensureSpace(doc, need) {
  if (doc.y + need > PAGE_BOTTOM) {
    doc.addPage();
    doc.y = MARGIN_X;
  }
}

/**
 * Dibuja una fila de celdas con bordes visibles (ISO/NOM).
 * @returns {number} y inferior de la fila
 */
function drawBorderedRow(doc, x0, y, cells, { fontSize = 7, bold = false, minHeight = 14 } = {}) {
  const heights = cells.map((c) => {
    const w = Math.max(4, c.w - PAD * 2);
    doc.font(bold || c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    return Math.max(
      minHeight,
      doc.heightOfString(String(c.text ?? ""), { width: w }) + PAD * 2
    );
  });
  const h = Math.max(...heights, minHeight);
  let x = x0;
  for (const c of cells) {
    strokeRect(doc, x, y, c.w, h);
    doc
      .font(bold || c.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(fontSize)
      .fillColor("#000");
    const align = c.align || "center";
    const textW = c.w - PAD * 2;
    const textH = doc.heightOfString(String(c.text ?? ""), { width: textW });
    const textY =
      c.valign === "top" ? y + PAD : y + Math.max(PAD, (h - textH) / 2);
    doc.text(String(c.text ?? ""), x + PAD, textY, {
      width: textW,
      align,
      lineBreak: true,
    });
    x += c.w;
  }
  return y + h;
}

function drawHeaderBand(doc, y, text) {
  const h = 16;
  strokeRect(doc, MARGIN_X, y, CONTENT_WIDTH, h);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
  const textH = doc.heightOfString(text, { width: CONTENT_WIDTH - 8 });
  doc.text(text, MARGIN_X + 4, y + (h - textH) / 2, {
    width: CONTENT_WIDTH - 8,
    align: "center",
  });
  return y + h;
}

/**
 * Dibuja la cotizacion con rejilla visible (formato ISO/NOM COMSA).
 */
export function drawQuoteDocument(doc, quote) {
  const model = buildQuotePrintModel(quote);
  const logoPath = getComsaLogoPath();
  const hasLogo = fs.existsSync(logoPath);

  // --- Header: logo | datos empresa (con borde exterior) ---
  const headerY = 32;
  const headerH = 78;
  strokeRect(doc, MARGIN_X, headerY, CONTENT_WIDTH, headerH);

  const logoW = 120;
  if (hasLogo) {
    try {
      doc.image(logoPath, MARGIN_X + 6, headerY + 8, {
        fit: [logoW, headerH - 16],
        align: "left",
        valign: "center",
      });
    } catch {
      /* ignore */
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(14).text("COMSA", MARGIN_X + 10, headerY + 28);
  }

  // Vertical divider under logo column
  doc
    .save()
    .moveTo(MARGIN_X + logoW + 14, headerY)
    .lineTo(MARGIN_X + logoW + 14, headerY + headerH)
    .lineWidth(0.7)
    .strokeColor(BORDER)
    .stroke()
    .restore();

  const infoX = MARGIN_X + logoW + 20;
  const infoW = PAGE_RIGHT - infoX - 6;
  let iy = headerY + 8;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  doc.text(model.company.legalName, infoX, iy, { width: infoW });
  iy = doc.y + 2;
  doc.font("Helvetica").fontSize(7);
  if (model.company.phone) {
    doc.text(`Tel: ${model.company.phone}`, infoX, iy, { width: infoW });
    iy = doc.y;
  }
  if (model.company.phone) {
    doc.text(`Cel: ${model.company.phone}`, infoX, iy, { width: infoW });
    iy = doc.y;
  }
  if (model.company.email) {
    doc.text(model.company.email, infoX, iy, { width: infoW });
    iy = doc.y;
  }
  if (model.company.address) {
    doc.text(model.company.address, infoX, iy, { width: infoW });
  }

  let y = headerY + headerH;

  // --- Titulo COTIZACION ---
  y = drawBorderedRow(
    doc,
    MARGIN_X,
    y,
    [
      {
        text: `COTIZACION #${model.folio}`,
        w: CONTENT_WIDTH,
        align: "center",
        bold: true,
      },
    ],
    { fontSize: 12, bold: true, minHeight: 22 }
  );

  // --- Meta 3 filas x 4 celdas ---
  const labelW = 78;
  const valueW = (CONTENT_WIDTH - labelW * 2) / 2;
  const metaRows = [
    [
      { text: "Empresa", w: labelW, bold: true },
      { text: model.meta.empresa, w: valueW },
      { text: "Requisicion", w: labelW, bold: true },
      { text: model.meta.requisicion, w: valueW },
    ],
    [
      { text: "Responsable", w: labelW, bold: true },
      { text: model.meta.responsable, w: valueW },
      { text: "Emitida", w: labelW, bold: true },
      { text: model.meta.emitida, w: valueW },
    ],
    [
      { text: "Atentamente", w: labelW, bold: true },
      { text: model.meta.atentamente, w: valueW },
      { text: "Vigencia hasta", w: labelW, bold: true },
      { text: model.meta.vigenciaHasta, w: valueW },
    ],
  ];
  for (const row of metaRows) {
    y = drawBorderedRow(doc, MARGIN_X, y, row, { fontSize: 8, minHeight: 14 });
  }

  // --- Tabla de partidas ---
  const cols = [
    { key: "pos", label: "#", w: 20, align: "center" },
    { key: "desc", label: "Descripcion", w: 168, align: "left" },
    { key: "delivery", label: "Tiempo de entrega", w: 58, align: "center" },
    { key: "comments", label: "Comentarios", w: 78, align: "left" },
    { key: "unitPrice", label: "Precio Unitario", w: 62, align: "right" },
    { key: "discount", label: "Descuento", w: 50, align: "right" },
    { key: "qty", label: "Cantidad", w: 42, align: "center" },
    { key: "amount", label: "Importe", w: 54, align: "right" },
  ];
  // Ajuste fino para sumar CONTENT_WIDTH
  const colSum = cols.reduce((s, c) => s + c.w, 0);
  if (colSum !== CONTENT_WIDTH) {
    cols[1].w += CONTENT_WIDTH - colSum;
  }

  y = drawBorderedRow(
    doc,
    MARGIN_X,
    y,
    cols.map((c) => ({
      text: c.label,
      w: c.w,
      align: "center",
      bold: true,
      valign: "middle",
    })),
    { fontSize: 7, bold: true, minHeight: 22 }
  );

  const itemRows =
    model.items.length > 0
      ? model.items
      : [
          {
            position: "",
            description: "",
            deliveryRange: "",
            deliveryUnit: "",
            comments: "",
            unitPrice: "",
            discount: "",
            quantity: "",
            amount: "",
          },
        ];

  for (const item of itemRows) {
    const deliveryText = item.deliveryUnit
      ? `${item.deliveryRange}\n${item.deliveryUnit}`
      : item.deliveryRange || "";
    const cells = [
      { text: String(item.position ?? ""), w: cols[0].w, align: "center" },
      { text: item.description || "", w: cols[1].w, align: "left" },
      { text: deliveryText, w: cols[2].w, align: "center" },
      { text: item.comments || "", w: cols[3].w, align: "left" },
      { text: item.unitPrice || "", w: cols[4].w, align: "right" },
      { text: item.discount || "", w: cols[5].w, align: "right" },
      { text: item.quantity || "", w: cols[6].w, align: "center" },
      { text: item.amount || "", w: cols[7].w, align: "right" },
    ];
    // estimar altura para salto de pagina
    doc.font("Helvetica").fontSize(7);
    const estH = Math.max(
      ...cells.map((c) =>
        doc.heightOfString(String(c.text), { width: c.w - PAD * 2 })
      ),
      14
    ) + PAD * 2;
    if (y + estH > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN_X;
      y = drawBorderedRow(
        doc,
        MARGIN_X,
        y,
        cols.map((c) => ({
          text: c.label,
          w: c.w,
          align: "center",
          bold: true,
          valign: "middle",
        })),
        { fontSize: 7, bold: true, minHeight: 22 }
      );
    }
    y = drawBorderedRow(doc, MARGIN_X, y, cells, { fontSize: 7, minHeight: 14 });
  }

  // --- Totales: banner + tabla ---
  const totalsLabelW = 120;
  const totalsValueW = 70;
  const totalsBlockW = totalsLabelW + totalsValueW;
  const bannerW = CONTENT_WIDTH - totalsBlockW;
  const totalLines = [
    ["Subtotal sin IVA", model.totals.subtotal, false],
    ["IVA", model.totals.tax, false],
    ["Total con IVA", model.totals.total, true],
  ];
  const rowH = 14;
  const totalsH = rowH * totalLines.length;

  if (y + totalsH > PAGE_BOTTOM) {
    doc.addPage();
    y = MARGIN_X;
  }

  strokeRect(doc, MARGIN_X, y, bannerW, totalsH);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  const bannerTextH = doc.heightOfString(model.currencyBanner, {
    width: bannerW - 8,
  });
  doc.text(model.currencyBanner, MARGIN_X + 4, y + (totalsH - bannerTextH) / 2, {
    width: bannerW - 8,
    align: "center",
  });

  let ty = y;
  for (const [label, value, isBold] of totalLines) {
    // Altura fija para alinear con el banner
    strokeRect(doc, MARGIN_X + bannerW, ty, totalsLabelW, rowH);
    strokeRect(doc, MARGIN_X + bannerW + totalsLabelW, ty, totalsValueW, rowH);
    doc
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8)
      .fillColor("#000");
    doc.text(label, MARGIN_X + bannerW + PAD, ty + 3, {
      width: totalsLabelW - PAD * 2,
      align: "center",
    });
    doc.text(value, MARGIN_X + bannerW + totalsLabelW + PAD, ty + 3, {
      width: totalsValueW - PAD * 2,
      align: "right",
    });
    ty += rowH;
  }
  y = ty;
  doc.y = y;

  // --- NOTAS ---
  ensureSpace(doc, 80);
  y = Math.max(y, doc.y);
  y = drawHeaderBand(doc, y, "NOTAS");
  const noteIdxW = 24;
  const noteTextW = CONTENT_WIDTH - noteIdxW;
  model.notes.forEach((note, idx) => {
    doc.font("Helvetica").fontSize(7);
    const est =
      doc.heightOfString(note, { width: noteTextW - PAD * 2 }) + PAD * 2;
    if (y + est > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN_X;
    }
    y = drawBorderedRow(
      doc,
      MARGIN_X,
      y,
      [
        { text: String(idx + 1), w: noteIdxW, align: "center", bold: true },
        { text: note, w: noteTextW, align: "left" },
      ],
      { fontSize: 7, minHeight: 14 }
    );
  });

  // --- CANCELACION O CAMBIO ---
  if (y + 80 > PAGE_BOTTOM) {
    doc.addPage();
    y = MARGIN_X;
  }
  y = drawHeaderBand(doc, y, "CANCELACION O CAMBIO");
  for (const row of model.cancellation) {
    doc.font("Helvetica").fontSize(7);
    const est =
      doc.heightOfString(row.text, { width: noteTextW - PAD * 2 }) + PAD * 2;
    if (y + est > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN_X;
    }
    y = drawBorderedRow(
      doc,
      MARGIN_X,
      y,
      [
        { text: row.key, w: noteIdxW, align: "center", bold: true },
        { text: row.text, w: noteTextW, align: "left" },
      ],
      { fontSize: 7, minHeight: 14 }
    );
  }

  // --- Footer pedido ---
  if (y + 56 > PAGE_BOTTOM) {
    doc.addPage();
    y = MARGIN_X;
  }
  const footLeftW = CONTENT_WIDTH * 0.48;
  const footRightW = CONTENT_WIDTH - footLeftW;
  const footLines = [
    model.company.legalName,
    model.company.email ? `E-mail: ${model.company.email}` : "",
    model.company.rfc ? `RFC: ${model.company.rfc}` : "",
  ].filter(Boolean);
  doc.font("Helvetica").fontSize(7);
  const footRightH = Math.max(
    40,
    footLines.reduce(
      (sum, line) =>
        sum + doc.heightOfString(line, { width: footRightW - PAD * 2 }),
      PAD * 2 + 4
    )
  );

  strokeRect(doc, MARGIN_X, y, footLeftW, footRightH);
  doc.font("Helvetica").fontSize(7).fillColor("#000");
  doc.text(
    "En caso de vernos favorecidos con su pedido por favor dirigirlo a:",
    MARGIN_X + PAD,
    y + PAD,
    { width: footLeftW - PAD * 2 }
  );

  strokeRect(doc, MARGIN_X + footLeftW, y, footRightW, footRightH);
  let fy = y + PAD;
  footLines.forEach((line, i) => {
    doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(7);
    doc.text(line, MARGIN_X + footLeftW + PAD, fy, {
      width: footRightW - PAD * 2,
    });
    fy = doc.y + 1;
  });

  y += footRightH + 6;
  doc.font("Helvetica").fontSize(7).fillColor("#444");
  doc.text(model.revisionLabel, MARGIN_X, y, {
    width: CONTENT_WIDTH,
    align: "left",
  });
  doc.fillColor("#000");
  doc.y = y + 12;
}

export async function buildQuotePdfBuffer(quote) {
  return buildPdfBuffer(
    (doc) => {
      drawQuoteDocument(doc, quote);
    },
    { margin: 36 }
  );
}

export async function quotePdfResponse(quote) {
  const buffer = await buildQuotePdfBuffer(quote);
  return pdfResponse(buffer, `cotizacion-${quote.folio}.pdf`);
}
