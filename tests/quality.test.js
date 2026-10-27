import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
  buildPermissionList,
} from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";
import {
  calcSampleCount,
  isPieceInSample,
  piecesForReview,
  pieceLabel,
  OPEN_QUALITY_ITEM_STATUSES,
} from "../domains/quality/constants.js";

test("catalogo incluye permisos de quality", () => {
  const codes = new Set(buildPermissionList().map((p) => p.code));
  assert.ok(codes.has("quality.view"));
  assert.ok(codes.has("quality.inspect"));
  assert.ok(codes.has("quality.register_qty"));
  assert.ok(codes.has("quality.configure_sampling"));
  assert.ok(codes.has("quality.release_first_piece"));
  assert.ok(codes.has("quality.manage_instruments"));
  assert.ok(codes.has("quality.generate_external_qr"));
});

test("ALL_PERMISSION_CODES incluye quality", () => {
  assert.ok(ALL_PERMISSION_CODES.includes("quality.view"));
  assert.ok(ALL_PERMISSION_CODES.includes("quality.close_inspection"));
});

test("rol Calidad tiene all quality", () => {
  const role = SYSTEM_ROLES.find((r) => r.name === "Calidad");
  assert.ok(role);
  assert.ok(role.permissions.includes("quality.view"));
  assert.ok(role.permissions.includes("quality.inspect"));
  assert.ok(role.permissions.includes("quality.create_rework"));
});

test("menu muestra Calidad con permiso y sin Planos globales", () => {
  const menu = buildMenu(["dashboard.view", "quality.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/calidad"));
  assert.ok(!hrefs.includes("/calidad/planos"));
});

test("calcSampleCount calcula 1 de cada N", () => {
  assert.equal(calcSampleCount(20, 5), 4);
  assert.equal(calcSampleCount(15, 4), 3);
  assert.equal(calcSampleCount(21, 5), 4);
  assert.equal(calcSampleCount(0, 5), 0);
  assert.equal(calcSampleCount(10, 0), 0);
});

test("isPieceInSample marca cada N-esima pieza", () => {
  assert.equal(isPieceInSample(4, 4), true);
  assert.equal(isPieceInSample(8, 4), true);
  assert.equal(isPieceInSample(12, 4), true);
  assert.equal(isPieceInSample(1, 4), false);
  assert.equal(isPieceInSample(15, 4), false);
});

test("piecesForReview en muestreo oculta piezas fuera de muestra", () => {
  const pieces = [
    { id: "1", isSample: false, isFirstPiece: true },
    { id: "2", isSample: false, isFirstPiece: false },
    { id: "4", isSample: true, isFirstPiece: false },
  ];
  assert.equal(piecesForReview(pieces, "FULL").length, 3);
  assert.deepEqual(
    piecesForReview(pieces, "SAMPLE").map((p) => p.id),
    ["1", "4"]
  );
});

test("pieceLabel formatea numero", () => {
  assert.equal(pieceLabel(1), "Pieza 01");
  assert.equal(pieceLabel(12), "Pieza 12");
});

test("OPEN_QUALITY_ITEM_STATUSES no incluye CLOSED", () => {
  assert.ok(!OPEN_QUALITY_ITEM_STATUSES.includes("CLOSED"));
  assert.ok(OPEN_QUALITY_ITEM_STATUSES.includes("PENDING"));
  assert.ok(OPEN_QUALITY_ITEM_STATUSES.includes("FIRST_PIECE_PENDING"));
});
