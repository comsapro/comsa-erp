// Analizador minimo de PDF para verificar formatos controlados: devuelve el texto con
// coordenadas y los rectangulos (bordes de tabla) de cada pagina. Se usa para comparar
// los documentos generados contra los machotes de calidad.
import fs from "node:fs";
import zlib from "node:zlib";

// Los subsets TrueType de Chrome usan el indice de glifo como CID; en las fuentes tipo
// Arial el glifo 3 es el espacio, asi que el rango ASCII queda desplazado 29.
const GLYPH_OFFSET = 29;

const TOKEN_RE =
  /\[(?:[^\]\\]|\\.)*\]|\((?:[^)\\]|\\.)*\)|<[0-9A-Fa-f\s]*>|\/[^\s/[\]()<>]+|[-+]?[0-9]*\.?[0-9]+|[A-Za-z'"*]+/g;

function round(n) {
  return Math.round(n * 100) / 100;
}

function inflate(buf) {
  const attempts = [
    () => zlib.inflateSync(buf),
    () => zlib.inflateRawSync(buf),
    () => zlib.inflateSync(buf.subarray(1)),
  ];
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      /* siguiente intento */
    }
  }
  return null;
}

function collectStreams(buffer) {
  const out = [];
  const marker = Buffer.from("stream");
  let idx = 0;
  while (true) {
    const start = buffer.indexOf(marker, idx);
    if (start === -1) break;
    let dataStart = start + marker.length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf(Buffer.from("endstream"), dataStart);
    if (end === -1) break;
    const dictStart = buffer.lastIndexOf(Buffer.from("<<"), start);
    const dict = dictStart === -1 ? "" : buffer.subarray(dictStart, start).toString("latin1");
    const body = buffer.subarray(dataStart, end);
    const data = /FlateDecode/.test(dict) ? inflate(body) : body;
    if (data) out.push({ dict, data });
    idx = end + 9;
  }
  return out;
}

// Glifos del subset Arial del machote que no caen en el rango ASCII desplazado.
const GLYPH_MAP = new Map([
  [121, "ó"],
  [116, "í"],
  [162, "¿"],
  [7548, "▢"],
  [15360, "✓"],
  [15872, "✕"],
]);

function cidToChar(code) {
  const mapped = GLYPH_MAP.get(code);
  if (mapped) return mapped;
  const ascii = code + GLYPH_OFFSET;
  if (ascii >= 32 && ascii < 127) return String.fromCharCode(ascii);
  return `[${code}]`;
}

function printableScore(text) {
  const unknown = (text.match(/\[\d+\]/g) || []).length;
  let printable = 0;
  for (const char of text.replace(/\[\d+\]/g, "")) {
    printable += char.charCodeAt(0) >= 32 ? 1 : -1;
  }
  return printable - unknown * 5;
}

// El machote (impresion de Chrome) usa CIDs de dos bytes; PDFKit usa codigos WinAnsi de
// un byte. Se prueban ambas lecturas y se conserva la que produce texto legible.
function decodeHex(hex) {
  let wide = "";
  for (let i = 0; i < hex.length; i += 4) {
    wide += cidToChar(parseInt(hex.slice(i, i + 4).padEnd(4, "0"), 16));
  }
  let narrow = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2).padEnd(2, "0"), 16);
    narrow += Buffer.from([code]).toString("latin1");
  }
  return printableScore(narrow) > printableScore(wide) ? narrow : wide;
}

function decodeString(token) {
  if (token.startsWith("(")) {
    return token
      .slice(1, -1)
      .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] || c))
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  }
  if (token.startsWith("<")) {
    return decodeHex(token.slice(1, -1).replace(/\s+/g, ""));
  }
  return "";
}

function parseContentStream(text) {
  const tokens = text.match(TOKEN_RE) || [];
  const stack = [];
  const items = { texts: [], rects: [] };
  const ctmStack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let tm = [1, 0, 0, 1, 0, 0];
  let leading = 0;
  let font = null;
  let size = 0;
  let path = [];

  const num = (v) => Number(v) || 0;
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
  const pushText = (strToken) => {
    const trm = mul(tm, ctm);
    const [x, y] = apply(trm, 0, 0);
    items.texts.push({
      text: decodeString(strToken),
      x: round(x),
      y: round(y),
      size: round(size * Math.hypot(trm[0], trm[1])),
      font,
    });
  };

  for (const token of tokens) {
    if (
      /^[-+]?[0-9]*\.?[0-9]+$/.test(token) ||
      token.startsWith("/") ||
      token.startsWith("(") ||
      token.startsWith("<") ||
      token.startsWith("[")
    ) {
      stack.push(token);
      continue;
    }
    const args = stack.slice();
    stack.length = 0;
    switch (token) {
      case "q":
        ctmStack.push(ctm.slice());
        break;
      case "Q":
        ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
        break;
      case "cm":
        ctm = mul(args.slice(-6).map(num), ctm);
        break;
      case "BT":
        tm = [1, 0, 0, 1, 0, 0];
        break;
      case "Tf":
        font = args[args.length - 2];
        size = num(args[args.length - 1]);
        break;
      case "TL":
        leading = num(args[args.length - 1]);
        break;
      case "Tm":
        tm = args.slice(-6).map(num);
        break;
      case "Td":
        tm = mul([1, 0, 0, 1, num(args[args.length - 2]), num(args[args.length - 1])], tm);
        break;
      case "TD":
        leading = -num(args[args.length - 1]);
        tm = mul([1, 0, 0, 1, num(args[args.length - 2]), num(args[args.length - 1])], tm);
        break;
      case "T*":
        tm = mul([1, 0, 0, 1, 0, -leading], tm);
        break;
      case "Tj":
      case "'":
      case '"': {
        const strToken = args.filter((a) => a.startsWith("(") || a.startsWith("<")).pop();
        if (strToken) pushText(strToken);
        break;
      }
      case "TJ": {
        const arrToken = args.filter((a) => a.startsWith("[")).pop();
        if (arrToken) {
          const parts = arrToken.match(/\((?:[^)\\]|\\.)*\)|<[0-9A-Fa-f\s]*>/g) || [];
          const trm = mul(tm, ctm);
          const [x, y] = apply(trm, 0, 0);
          items.texts.push({
            text: parts.map(decodeString).join(""),
            x: round(x),
            y: round(y),
            size: round(size * Math.hypot(trm[0], trm[1])),
            font,
          });
        }
        break;
      }
      case "re": {
        const [x, y, w, h] = args.slice(-4).map(num);
        const [x0, y0] = apply(ctm, x, y);
        const [x1, y1] = apply(ctm, x + w, y + h);
        items.rects.push({
          x: round(Math.min(x0, x1)),
          y: round(Math.min(y0, y1)),
          w: round(Math.abs(x1 - x0)),
          h: round(Math.abs(y1 - y0)),
        });
        break;
      }
      case "m":
      case "l": {
        const [x, y] = args.slice(-2).map(num);
        const [px, py] = apply(ctm, x, y);
        path.push({ x: round(px), y: round(py) });
        break;
      }
      case "S":
      case "s":
      case "f":
      case "F":
      case "f*":
      case "B":
      case "b":
      case "n":
        path = [];
        break;
      default:
        break;
    }
  }
  return items;
}

export function analyzePdf(source) {
  const raw = Buffer.isBuffer(source) ? source : fs.readFileSync(source);
  const pages = [];
  for (const stream of collectStreams(raw)) {
    // Los binarios de imagen no se parsean: sus bytes disparan los operadores de texto.
    if (/\/Subtype\s*\/Image|\/DCTDecode/.test(stream.dict)) continue;
    const text = stream.data.toString("latin1");
    if (!/(\bBT\b|\bTj\b|\bTJ\b|\bre\b)/.test(text)) continue;
    pages.push(parseContentStream(text));
  }
  const mediaBoxes = [
    ...raw.toString("latin1").matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/g),
  ].map((m) => m.slice(1).map(Number));
  return { mediaBoxes, pages };
}

const THIN = 2;

export function horizontalBorders(page) {
  return page.rects
    .filter((r) => r.h <= THIN && r.w > THIN)
    .map((r) => ({ y: r.y, x1: r.x, x2: round(r.x + r.w) }));
}

export function verticalBorders(page) {
  return page.rects
    .filter((r) => r.w <= THIN && r.h > THIN)
    .map((r) => ({ x: r.x, y1: r.y, y2: round(r.y + r.h) }));
}

// Une los fragmentos de texto que comparten linea base para poder comparar cadenas
// completas entre el machote (que parte los runs) y el PDF generado.
export function textLines(page, tolerance = 0.6) {
  const groups = [];
  for (const item of page.texts) {
    if (!item.text.trim()) continue;
    // Las casillas y marcas del machote son glifos de una fuente de simbolos; el ERP las
    // dibuja como vector, asi que no participan en la comparacion de texto.
    if (/^[▢✓✕\s]+$/.test(item.text)) continue;
    const group = groups.find((g) => Math.abs(g.y - item.y) <= tolerance);
    if (group) {
      group.items.push(item);
      continue;
    }
    groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const items = group.items.slice().sort((a, b) => a.x - b.x);
      return {
        y: group.y,
        x: items[0].x,
        size: items[0].size,
        text: items
          .map((i) => i.text)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
      };
    })
    .sort((a, b) => b.y - a.y);
}
