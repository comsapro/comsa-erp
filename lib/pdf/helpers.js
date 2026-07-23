import PDFDocument from "pdfkit";

/**
 * Construye un PDF en memoria y lo devuelve como Buffer.
 * @param {(doc: import("pdfkit")) => void} build
 */
export function buildPdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function pdfResponse(buffer, filename) {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

export function drawReportHeader(doc, { title, generatedBy, filters = [] }) {
  doc.fontSize(16).text(title, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#555");
  doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`);
  doc.text(`Usuario: ${generatedBy || "Sistema"}`);
  if (filters.length) {
    doc.text(`Filtros: ${filters.join(" | ")}`);
  }
  doc.fillColor("#000");
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#ccc");
  doc.moveDown();
}

export function drawTable(doc, columns, rows) {
  const startX = 50;
  const usable = 512;
  const widths = columns.map((c) => c.width || usable / columns.length);
  let y = doc.y;

  doc.fontSize(8).font("Helvetica-Bold");
  let x = startX;
  for (let i = 0; i < columns.length; i++) {
    doc.text(columns[i].header, x, y, { width: widths[i], continued: false });
    x += widths[i];
  }
  y += 14;
  doc.moveTo(startX, y).lineTo(startX + usable, y).stroke("#ddd");
  y += 4;
  doc.font("Helvetica");

  for (const row of rows) {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    x = startX;
    let rowHeight = 12;
    for (let i = 0; i < columns.length; i++) {
      const text = String(row[columns[i].key] ?? "");
      doc.text(text, x, y, { width: widths[i], height: 36 });
      x += widths[i];
    }
    y += rowHeight + 4;
  }
  doc.y = y;
}

export function drawFooterTotals(doc, { count, totals = [] }) {
  doc.moveDown();
  doc.fontSize(9);
  doc.text(`Registros: ${count}`);
  for (const t of totals) {
    doc.text(`${t.label}: ${t.value}`);
  }
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#888");
    doc.text(`Pagina ${i - range.start + 1} de ${range.count}`, 50, 750, {
      align: "center",
      width: 512,
    });
    doc.fillColor("#000");
  }
}
