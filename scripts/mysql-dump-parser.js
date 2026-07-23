import fs from "fs";
import readline from "readline";

/**
 * Decode common HTML entities found in the legacy MySQL dump.
 */
export function decodeHtmlEntities(value) {
  if (value == null) return value;
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Parse the inner content of a MySQL VALUES tuple into JS values.
 * Handles NULL, numbers, quoted strings with '' and \' escapes.
 */
export function parseMysqlTuple(inner) {
  const values = [];
  let i = 0;
  const s = inner;

  while (i < s.length) {
    while (s[i] === " " || s[i] === "\t" || s[i] === "\n" || s[i] === "\r") {
      i += 1;
    }
    if (i >= s.length) break;

    if (s.startsWith("NULL", i) && (i + 4 >= s.length || s[i + 4] === ",")) {
      values.push(null);
      i += 4;
      if (s[i] === ",") i += 1;
      continue;
    }

    if (s[i] === "'") {
      i += 1;
      let out = "";
      while (i < s.length) {
        const ch = s[i];
        if (ch === "\\" && i + 1 < s.length) {
          const next = s[i + 1];
          const map = { n: "\n", r: "\r", t: "\t", "0": "\0", "'": "'", '"': '"', "\\": "\\" };
          out += map[next] ?? next;
          i += 2;
          continue;
        }
        if (ch === "'" && s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        if (ch === "'") {
          i += 1;
          break;
        }
        out += ch;
        i += 1;
      }
      values.push(decodeHtmlEntities(out));
      if (s[i] === ",") i += 1;
      continue;
    }

    // Unquoted number / bare token
    let j = i;
    while (j < s.length && s[j] !== ",") j += 1;
    const raw = s.slice(i, j).trim();
    if (raw === "") {
      values.push(null);
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      values.push(Number(raw));
    } else {
      values.push(decodeHtmlEntities(raw));
    }
    i = j;
    if (s[i] === ",") i += 1;
  }

  return values;
}

/**
 * Split a VALUES body into tuple inners, respecting quotes.
 */
export function splitMysqlTuples(valuesBody) {
  const tuples = [];
  let i = 0;
  const s = valuesBody;

  while (i < s.length) {
    while (i < s.length && s[i] !== "(") i += 1;
    if (i >= s.length) break;
    i += 1; // skip '('
    let depth = 1;
    let start = i;
    let inStr = false;

    while (i < s.length && depth > 0) {
      const ch = s[i];
      if (inStr) {
        if (ch === "\\" && i + 1 < s.length) {
          i += 2;
          continue;
        }
        if (ch === "'" && s[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (ch === "'") {
          inStr = false;
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (ch === "'") {
        inStr = true;
        i += 1;
        continue;
      }
      if (ch === "(") {
        depth += 1;
        i += 1;
        continue;
      }
      if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          tuples.push(s.slice(start, i));
          i += 1;
          break;
        }
        i += 1;
        continue;
      }
      i += 1;
    }
  }

  return tuples;
}

function zipRow(columns, values) {
  const row = {};
  for (let i = 0; i < columns.length; i += 1) {
    row[columns[i]] = values[i] ?? null;
  }
  return row;
}

/**
 * Stream-parse a mysqldump file and return rows for the requested tables.
 * @param {string} filePath
 * @param {string[]} tableNames
 * @returns {Promise<Record<string, object[]>>}
 */
export async function extractTablesFromDump(filePath, tableNames) {
  const wanted = new Set(tableNames);
  const result = Object.fromEntries(tableNames.map((t) => [t, []]));

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let currentTable = null;
  let columns = null;
  let buffer = "";
  let collecting = false;
  let pendingInsert = null; // { table, columns } waiting for VALUES line

  const flushBuffer = () => {
    if (!currentTable || !columns || !buffer) return;
    const body = buffer.replace(/;\s*$/, "");
    for (const inner of splitMysqlTuples(body)) {
      const values = parseMysqlTuple(inner);
      result[currentTable].push(zipRow(columns, values));
    }
    buffer = "";
  };

  const startCollecting = (table, cols) => {
    if (collecting) flushBuffer();
    if (!wanted.has(table)) {
      currentTable = null;
      columns = null;
      collecting = false;
      buffer = "";
      pendingInsert = null;
      return;
    }
    currentTable = table;
    columns = cols;
    collecting = true;
    buffer = "";
    pendingInsert = null;
  };

  const parseColumns = (raw) =>
    raw.split(",").map((c) => c.trim().replace(/^`|`$/g, ""));

  for await (const line of rl) {
    if (line.startsWith("UNLOCK TABLES") || line.startsWith("-- Dumping data")) {
      if (collecting) flushBuffer();
      currentTable = null;
      columns = null;
      collecting = false;
      buffer = "";
      pendingInsert = null;
      continue;
    }

    // INSERT INTO `t` (cols)   — VALUES may be on next line
    const insertOnly = line.match(/^INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*$/i);
    if (insertOnly) {
      pendingInsert = {
        table: insertOnly[1],
        columns: parseColumns(insertOnly[2]),
      };
      continue;
    }

    // INSERT INTO `t` (cols) VALUES
    const insertValuesHeader = line.match(
      /^INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*$/i
    );
    if (insertValuesHeader) {
      startCollecting(
        insertValuesHeader[1],
        parseColumns(insertValuesHeader[2])
      );
      continue;
    }

    // VALUES line after INSERT header (optionally with first rows)
    if (pendingInsert && /^\s*VALUES\b/i.test(line)) {
      const rest = line.replace(/^\s*VALUES\s*/i, "");
      startCollecting(pendingInsert.table, pendingInsert.columns);
      if (rest.trim()) buffer += `${rest}\n`;
      continue;
    }

    // Inline INSERT ... VALUES (...);
    const inlineMatch = line.match(
      /^INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*(.+);\s*$/i
    );
    if (inlineMatch) {
      if (collecting) flushBuffer();
      const table = inlineMatch[1];
      if (wanted.has(table)) {
        const cols = parseColumns(inlineMatch[2]);
        for (const inner of splitMysqlTuples(inlineMatch[3])) {
          result[table].push(zipRow(cols, parseMysqlTuple(inner)));
        }
      }
      currentTable = null;
      columns = null;
      collecting = false;
      buffer = "";
      pendingInsert = null;
      continue;
    }

    if (collecting && currentTable) {
      buffer += `${line}\n`;
    }
  }

  if (collecting) flushBuffer();
  return result;
}
