/**
 * Utilidades de versionado de cotizaciones.
 * Folio tipico: YYMM-CONSECUTIVO-LETRA (ej. 2607-38-A).
 */

export function parseFolioVersion(folio) {
  const raw = String(folio || "").trim();
  const match = raw.match(/^(.*)-([A-Z])$/i);
  if (!match) {
    return { base: raw, letter: "A" };
  }
  return {
    base: match[1],
    letter: match[2].toUpperCase(),
  };
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filtra y ordena cotizaciones que pertenecen a la misma familia de folio.
 */
export function filterVersionFamily(rows, base) {
  const re = new RegExp(`^${escapeRegExp(base)}-([A-Z])$`, "i");
  return (rows || [])
    .filter((row) => re.test(String(row.folio || "")))
    .sort((a, b) => {
      const la = String(a.version || parseFolioVersion(a.folio).letter);
      const lb = String(b.version || parseFolioVersion(b.folio).letter);
      return la.localeCompare(lb);
    });
}

/**
 * Devuelve la siguiente letra disponible en la familia (A..Z).
 * @param {Array<{folio:string, version?:string}>} familyRows
 */
export function nextAvailableLetter(familyRows, base) {
  const family = filterVersionFamily(familyRows, base);
  let maxCode = "A".charCodeAt(0) - 1;
  for (const row of family) {
    const letter = String(
      row.version || parseFolioVersion(row.folio).letter || "A"
    ).toUpperCase();
    if (letter.length === 1 && letter >= "A" && letter <= "Z") {
      maxCode = Math.max(maxCode, letter.charCodeAt(0));
    }
  }
  const nextCode = maxCode + 1;
  if (nextCode > "Z".charCodeAt(0)) {
    return null;
  }
  return String.fromCharCode(nextCode);
}
