import test from "node:test";
import assert from "node:assert/strict";
import {
  filterVersionFamily,
  nextAvailableLetter,
  parseFolioVersion,
} from "../domains/quotes/versions.js";

test("parseFolioVersion splits base and letter", () => {
  assert.deepEqual(parseFolioVersion("2607-38-A"), {
    base: "2607-38",
    letter: "A",
  });
  assert.deepEqual(parseFolioVersion("2607-38-b"), {
    base: "2607-38",
    letter: "B",
  });
});

test("nextAvailableLetter skips existing B when revising from A", () => {
  const family = [
    { folio: "2607-38-A", version: "A" },
    { folio: "2607-38-B", version: "B" },
  ];
  assert.equal(nextAvailableLetter(family, "2607-38"), "C");
});

test("nextAvailableLetter from empty family starts at A", () => {
  assert.equal(nextAvailableLetter([], "2607-38"), "A");
});

test("filterVersionFamily ignores unrelated folios", () => {
  const rows = [
    { folio: "2607-38-A", version: "A" },
    { folio: "2607-380-A", version: "A" },
    { folio: "2607-38-C", version: "C" },
  ];
  const family = filterVersionFamily(rows, "2607-38");
  assert.deepEqual(
    family.map((r) => r.folio),
    ["2607-38-A", "2607-38-C"]
  );
});
