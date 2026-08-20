import fs from "node:fs";
import path from "node:path";

// Los formatos controlados (control dimensional COM Revision 1.1 y orden de trabajo
// COM-OT-R-001) se reproducen con las coordenadas medidas del documento original,
// que esta en carta vertical con origen abajo-izquierda. Todas las funciones de este
// modulo reciben coordenadas en ese espacio y las traducen al de PDFKit.
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const BORDER = 0.75;

export const FRAME = {
  left: 28.5,
  right: 583.87,
  bottom: 28.13,
  top: 763.5,
};

const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";

export class IsoForm {
  constructor(doc) {
    this.doc = doc;
  }

  top(y) {
    return PAGE_HEIGHT - y;
  }

  hLine(y, x1, x2, thickness = BORDER) {
    this.doc
      .save()
      .fillColor("#000000")
      .rect(x1, this.top(y + thickness), x2 - x1, thickness)
      .fill()
      .restore();
    return this;
  }

  vLine(x, y1, y2, thickness = BORDER) {
    this.doc
      .save()
      .fillColor("#000000")
      .rect(x, this.top(y2), thickness, y2 - y1)
      .fill()
      .restore();
    return this;
  }

  frame() {
    this.doc
      .save()
      .lineWidth(BORDER)
      .strokeColor("#000000")
      .rect(FRAME.left, this.top(FRAME.top), FRAME.right - FRAME.left, FRAME.top - FRAME.bottom)
      .stroke()
      .restore();
    return this;
  }

  font(size, bold) {
    this.doc.font(bold ? BOLD : REGULAR).fontSize(size);
    return this.doc;
  }

  width(value, { size = 9.75, bold = false } = {}) {
    this.font(size, bold);
    return this.doc.widthOfString(String(value ?? ""));
  }

  text(value, x, baseline, { size = 9.75, bold = false } = {}) {
    const str = String(value ?? "");
    if (!str) return this;
    this.font(size, bold);
    this.doc
      .save()
      .fillColor("#000000")
      .text(str, x, this.top(baseline), { lineBreak: false, baseline: "alphabetic" })
      .restore();
    return this;
  }

  centered(value, x1, x2, baseline, options = {}) {
    const str = String(value ?? "");
    if (!str) return this;
    const w = this.width(str, options);
    return this.text(str, x1 + (x2 - x1 - w) / 2, baseline, options);
  }

  // El original usa una fuente de simbolos para las casillas; se dibujan como vector
  // porque Helvetica no tiene el glifo y el trazo debe medir igual (8.25 pt de avance).
  checkbox(x, baseline, size = 9.75) {
    const side = size * 0.66;
    this.doc
      .save()
      .lineWidth(0.6)
      .strokeColor("#000000")
      .rect(x + size * 0.09, this.top(baseline + side - 0.4), side, side)
      .stroke()
      .restore();
    return this;
  }

  checkboxAdvance(size = 9.75) {
    return size * 0.846;
  }

  checkMark(x, baseline, size = 6.75) {
    const s = size * 0.75;
    this.doc
      .save()
      .lineWidth(0.7)
      .strokeColor("#000000")
      .moveTo(x, this.top(baseline + s * 0.45))
      .lineTo(x + s * 0.35, this.top(baseline))
      .lineTo(x + s * 0.95, this.top(baseline + s))
      .stroke()
      .restore();
    return this;
  }

  crossMark(x, baseline, size = 6.75) {
    const s = size * 0.75;
    this.doc
      .save()
      .lineWidth(0.7)
      .strokeColor("#000000")
      .moveTo(x, this.top(baseline))
      .lineTo(x + s, this.top(baseline + s))
      .moveTo(x + s, this.top(baseline))
      .lineTo(x, this.top(baseline + s))
      .stroke()
      .restore();
    return this;
  }

  image(filePath, x, baseline, boxWidth, boxHeight) {
    if (!filePath || !fs.existsSync(filePath)) return this;
    try {
      this.doc.image(filePath, x, this.top(baseline + boxHeight), {
        fit: [boxWidth, boxHeight],
        align: "center",
        valign: "center",
      });
    } catch {
      /* si la imagen no se puede embeber, la celda queda vacia como en el machote */
    }
    return this;
  }

  wrap(value, maxWidth, options = {}) {
    const str = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!str) return [];
    const words = str.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.width(candidate, options) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // Recorta a una sola linea agregando puntos suspensivos, para celdas de altura fija.
  clip(value, maxWidth, options = {}) {
    let str = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!str) return "";
    if (this.width(str, options) <= maxWidth) return str;
    while (str.length > 1 && this.width(`${str}...`, options) > maxWidth) {
      str = str.slice(0, -1);
    }
    return `${str}...`;
  }
}

export function createIsoForm(doc) {
  return new IsoForm(doc);
}

export function getFormLogoPath() {
  const file = path.join(process.cwd(), "public", "branding", "comsa-logo.jpeg");
  return fs.existsSync(file) ? file : null;
}

export const PDF_OPTIONS = { size: "LETTER", margin: 0 };
