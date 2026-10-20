import test from "node:test";
import assert from "node:assert/strict";
import {
  filterOptionsLocally,
  normalizeSearch,
  visibleOptions,
} from "../lib/utils/option-filter.js";
import { isAbortError } from "../lib/api/client.js";

const SUPPLIERS = [
  { value: "1", label: "Aceros Amil", description: "AAM010101AAA" },
  { value: "2", label: "La Paloma", description: "PAL990101BBB" },
  { value: "3", label: "Palomares Industrial" },
  { value: "4", label: "Tornillería Pérez" },
];

test("normalizeSearch ignora acentos, mayusculas y espacios", () => {
  assert.equal(normalizeSearch("  TornilLería "), "tornilleria");
  assert.equal(normalizeSearch(null), "");
});

test("filtro local encuentra 'PALO' sin importar mayusculas", () => {
  const labels = filterOptionsLocally(SUPPLIERS, "PALO").map((o) => o.label);
  assert.deepEqual(labels, ["La Paloma", "Palomares Industrial"]);
});

test("filtro local busca tambien en la descripcion y sin acentos", () => {
  assert.deepEqual(
    filterOptionsLocally(SUPPLIERS, "aam0101").map((o) => o.value),
    ["1"]
  );
  assert.deepEqual(
    filterOptionsLocally(SUPPLIERS, "tornilleria").map((o) => o.value),
    ["4"]
  );
});

test("sin texto se muestran todas las opciones", () => {
  assert.equal(filterOptionsLocally(SUPPLIERS, "  ").length, 4);
});

test("busqueda remota pendiente: filtra localmente la lista anterior", () => {
  const shown = visibleOptions({
    options: SUPPLIERS,
    query: "PALO",
    remote: true,
    resolvedQuery: "",
  });
  assert.deepEqual(shown.map((o) => o.value), ["2", "3"]);
});

test("busqueda remota resuelta: respeta la respuesta del servidor tal cual", () => {
  // El servidor puede coincidir por razon social, que no se muestra en la etiqueta.
  const serverResult = [{ value: "9", label: "Distribuidora Norte" }];
  const shown = visibleOptions({
    options: serverResult,
    query: "palo ",
    remote: true,
    resolvedQuery: "palo",
  });
  assert.deepEqual(shown, serverResult);
});

test("respuesta de una busqueda anterior no se muestra sin filtrar", () => {
  const stale = visibleOptions({
    options: SUPPLIERS,
    query: "PALOM",
    remote: true,
    resolvedQuery: "PA",
  });
  assert.deepEqual(stale.map((o) => o.value), ["2", "3"]);
});

test("modo local siempre filtra", () => {
  const shown = visibleOptions({ options: SUPPLIERS, query: "amil", remote: false });
  assert.deepEqual(shown.map((o) => o.value), ["1"]);
});

test("isAbortError distingue cancelaciones de errores reales", () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(isAbortError(controller.signal.reason), true);
  assert.equal(isAbortError(new DOMException("x", "AbortError")), true);
  assert.equal(isAbortError(new Error("500")), false);
  assert.equal(isAbortError(null), false);
});
