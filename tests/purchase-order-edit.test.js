import test from "node:test";
import assert from "node:assert/strict";
import {
  toPreloadMaterial,
  mapSelectedMaterials,
  toPurchaseFormLine,
  toPurchaseItemPayload,
  linesWithoutCost,
  missingCostMessage,
} from "../domains/purchase-orders/preload.js";
import {
  poCanEdit,
  poCanPrint,
  poEditPermission,
} from "../domains/purchase-orders/constants.js";
import { SYSTEM_ROLES, ALL_PERMISSION_CODES } from "../lib/permissions/catalog.js";

const material = {
  id: "m1",
  itemId: null,
  descriptionSnapshot: "INOX 304",
  dimensions: "CAL 12 X 4 X 10 PIES",
  presentation: "LAMINA",
  unit: "PZA",
  quantity: 1,
  unitPrice: 100,
  supplierId: "s1",
  supplier: { name: "La Paloma Compañía de Metales S.A. de C.V." },
};

const roleCodes = (name) => SYSTEM_ROLES.find((r) => r.name === name).permissions;
const hasFrom = (codes) => (code) => codes.includes(code);

test("precarga: cantidad del material por pieza x piezas de la partida", () => {
  const row = toPreloadMaterial(material, { pieces: 15, includeCost: true });
  assert.equal(row.quantityPerPiece, 1);
  assert.equal(row.pieces, 15);
  assert.equal(row.quantity, 15);
});

test("precarga: cantidades con decimales se redondean a 3 decimales", () => {
  const row = toPreloadMaterial({ ...material, quantity: 0.333 }, { pieces: 3 });
  assert.equal(row.quantity, 0.999);
});

test("precarga: cotizacion legacy no multiplica la cantidad", () => {
  const row = toPreloadMaterial({ ...material, quantity: 15 }, { pieces: 15, perPiece: false });
  assert.equal(row.quantity, 15);
  assert.equal(row.pieces, null);
});

test("precarga: sin piezas cuenta como una", () => {
  assert.equal(toPreloadMaterial(material, { pieces: null }).quantity, 1);
});

test("precarga: el costo cotizado solo llega a quien puede ver costos", () => {
  assert.equal(toPreloadMaterial(material, { includeCost: true }).unitPrice, 100);
  assert.equal(toPreloadMaterial(material, { includeCost: false }).unitPrice, 0);
});

test("precarga: la linea de la OC trae el costo cotizado editable y como referencia", () => {
  const available = [toPreloadMaterial(material, { pieces: 15, includeCost: true })];
  const [mapped] = mapSelectedMaterials(available, ["m1"]);
  const line = toPurchaseFormLine(mapped);
  assert.equal(line.quantity, 15);
  assert.equal(line.unitPrice, 100);
  assert.equal(line.quotedUnitPrice, 100);

  const payload = toPurchaseItemPayload({ ...line, unitPrice: "120" });
  assert.equal(payload.unitPrice, 120);
  assert.equal(payload.sourceType, "QUOTE_MATERIAL");
  assert.equal(payload.sourceMaterialId, "m1");
  assert.equal("quotedUnitPrice" in payload, false, "la referencia no se guarda");
});

test("costo obligatorio: detecta partidas en cero y arma el mensaje", () => {
  const lines = [
    { descriptionSnapshot: "INOX 304", unitPrice: 0 },
    { descriptionSnapshot: "A-36", unitPrice: "250" },
    { descriptionSnapshot: "Aluminio", unitPrice: "" },
  ];
  assert.deepEqual(
    linesWithoutCost(lines).map((l) => l.descriptionSnapshot),
    ["INOX 304", "Aluminio"]
  );
  assert.equal(missingCostMessage(lines), "Captura el costo de: INOX 304, Aluminio");
  assert.equal(missingCostMessage([{ unitPrice: 10 }]), null);
});

test("edicion: borrador con purchase_orders.edit, pendiente con edit_pending", () => {
  assert.equal(poEditPermission("DRAFT"), "purchase_orders.edit");
  assert.equal(poEditPermission("PENDING_APPROVAL"), "purchase_orders.edit_pending");
  for (const status of ["APPROVED", "PARTIALLY_RECEIVED", "COMPLETED", "REJECTED", "CANCELLED"]) {
    assert.equal(poEditPermission(status), null, status);
  }
});

test("edicion: el supervisor modifica pendientes y compras no", () => {
  const supervisor = hasFrom(roleCodes("Supervisor"));
  const compras = hasFrom(roleCodes("Compras"));
  assert.equal(poCanEdit({ status: "PENDING_APPROVAL" }, supervisor), true);
  assert.equal(poCanEdit({ status: "PENDING_APPROVAL" }, compras), false);
  assert.equal(poCanEdit({ status: "DRAFT" }, compras), true);
  assert.equal(poCanEdit({ status: "APPROVED" }, supervisor), false);
});

test("supervisor aprueba y rechaza ordenes de compra", () => {
  const supervisor = roleCodes("Supervisor");
  for (const code of [
    "purchase_orders.approve",
    "purchase_orders.reject",
    "purchase_orders.edit_pending",
  ]) {
    assert.ok(supervisor.includes(code), code);
  }
  assert.ok(ALL_PERMISSION_CODES.includes("purchase_orders.edit_pending"));
});

test("PDF de OC solo despues de aprobada", () => {
  assert.equal(poCanPrint({ status: "DRAFT" }), false);
  assert.equal(poCanPrint({ status: "PENDING_APPROVAL" }), false);
  assert.equal(poCanPrint({ status: "APPROVED" }), true);
});
