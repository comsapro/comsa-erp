export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterOptionsLocally(options = [], query = "") {
  const q = normalizeSearch(query);
  if (!q) return options;
  return options.filter((o) =>
    normalizeSearch(`${o.label || ""} ${o.description || ""}`).includes(q)
  );
}

/**
 * Opciones a mostrar en un combobox.
 * Con busqueda remota, el servidor puede coincidir por campos que no se ven (razon social,
 * contacto), asi que su respuesta se muestra tal cual, pero solo cuando corresponde al texto
 * actual. Mientras llega, se filtra localmente para que la lista reaccione al escribir.
 */
export function visibleOptions({ options = [], query = "", remote = false, resolvedQuery = null }) {
  if (remote && resolvedQuery !== null && resolvedQuery === String(query).trim()) {
    return options;
  }
  return filterOptionsLocally(options, query);
}
