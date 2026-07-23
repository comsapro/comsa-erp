/**
 * Lightweight PHP serialize() parser for legacy `anexo` blobs.
 * Supports: null, bool, int, float, string, array (and nested).
 * Returns null on parse failure.
 */
export function phpUnserialize(input) {
  if (input == null) return null;
  const str = String(input).trim();
  if (!str) return null;

  let i = 0;

  function readUntil(ch) {
    const start = i;
    while (i < str.length && str[i] !== ch) i += 1;
    const val = str.slice(start, i);
    if (str[i] === ch) i += 1;
    return val;
  }

  function parse() {
    const type = str[i];
    i += 1;
    if (str[i] === ":") i += 1;

    switch (type) {
      case "N": {
        if (str[i] === ";") i += 1;
        return null;
      }
      case "b": {
        const v = readUntil(";");
        return v === "1";
      }
      case "i": {
        const v = readUntil(";");
        return Number.parseInt(v, 10);
      }
      case "d": {
        const v = readUntil(";");
        return Number.parseFloat(v);
      }
      case "s": {
        const len = Number.parseInt(readUntil(":"), 10);
        if (str[i] === '"') i += 1;
        const value = str.slice(i, i + len);
        i += len;
        if (str[i] === '"') i += 1;
        if (str[i] === ";") i += 1;
        return value;
      }
      case "a": {
        const count = Number.parseInt(readUntil(":"), 10);
        if (str[i] === "{") i += 1;
        const obj = {};
        let isList = true;
        for (let n = 0; n < count; n += 1) {
          const key = parse();
          const val = parse();
          obj[key] = val;
          if (key !== n) isList = false;
        }
        if (str[i] === "}") i += 1;
        if (isList) {
          const arr = [];
          for (let n = 0; n < count; n += 1) arr.push(obj[n]);
          return arr;
        }
        return obj;
      }
      default:
        throw new Error(`Unsupported PHP type at ${i - 1}: ${type}`);
    }
  }

  try {
    return parse();
  } catch {
    return null;
  }
}
