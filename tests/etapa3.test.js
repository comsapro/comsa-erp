import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStockChange,
  computeStockDelta,
  isLowStock,
} from "../domains/inventory/stock-math.js";
import { VALID_TRANSITIONS as TRANSFER_TRANSITIONS } from "../domains/transfers/constants.js";
import { VALID_TRANSITIONS as PO_TRANSITIONS } from "../domains/purchase-orders/constants.js";
import {
  calculatePurchaseLineTotals,
  calculatePurchaseHeaderTotals,
  remainingQuantity,
  resolvePurchaseItemStatus,
  resolvePurchaseOrderStatus,
  TAX_RATE,
} from "../domains/purchase-orders/calculations.js";
import {
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
  buildPermissionList,
} from "../lib/permissions/catalog.js";
import { buildMenu, NAV_SECTIONS } from "../lib/navigation/menu.js";
import { ValidationError } from "../lib/permissions/errors.js";

test("Entrada incrementa quantity", () => {
  const next = applyStockChange(
    { quantity: 10, reservedQuantity: 2 },
    "ENTRY",
    5
  );
  assert.equal(next.quantity, 15);
  assert.equal(next.reservedQuantity, 2);
  assert.equal(next.availableQuantity, 13);
});

test("Salida reduce stock y valida disponible", () => {
  const next = applyStockChange(
    { quantity: 10, reservedQuantity: 3 },
    "EXIT",
    5
  );
  assert.equal(next.quantity, 5);
  assert.equal(next.availableQuantity, 2);
});

test("No permite stock negativo", () => {
  assert.throws(
    () => applyStockChange({ quantity: 2, reservedQuantity: 0 }, "EXIT", 5),
    ValidationError
  );
});

test("Salida no puede consumir reservado", () => {
  assert.throws(
    () =>
      applyStockChange({ quantity: 10, reservedQuantity: 8 }, "EXIT", 5),
    ValidationError
  );
});

test("Ajuste OUT requiere delta negativo", () => {
  const delta = computeStockDelta("ADJUSTMENT_OUT", 3);
  assert.equal(delta.quantityDelta, -3);
});

test("Reservacion aumenta reserved", () => {
  const next = applyStockChange(
    { quantity: 10, reservedQuantity: 1 },
    "RESERVATION",
    2
  );
  assert.equal(next.reservedQuantity, 3);
  assert.equal(next.availableQuantity, 7);
});

test("isLowStock cuando available <= minimo", () => {
  assert.equal(isLowStock(5, 5), true);
  assert.equal(isLowStock(4, 5), true);
  assert.equal(isLowStock(6, 5), false);
});

test("Transferencia no se completa dos veces (transiciones)", () => {
  assert.ok(TRANSFER_TRANSITIONS.APPROVED.includes("COMPLETED"));
  assert.deepEqual(TRANSFER_TRANSITIONS.COMPLETED, []);
});

test("OC no se envia sin items (regla de calculo)", () => {
  const header = calculatePurchaseHeaderTotals([]);
  assert.equal(header.total, 0);
});

test("Totales de partida OC con IVA 16%", () => {
  const line = calculatePurchaseLineTotals(2, 100);
  assert.equal(line.subtotal, 200);
  assert.equal(line.taxAmount, Math.round(200 * TAX_RATE * 100) / 100);
  assert.equal(line.total, line.subtotal + line.taxAmount);
});

test("Cantidad pendiente y estatus de item", () => {
  assert.equal(remainingQuantity(10, 3), 7);
  assert.equal(resolvePurchaseItemStatus(10, 0), "PENDING");
  assert.equal(resolvePurchaseItemStatus(10, 4), "PARTIAL");
  assert.equal(resolvePurchaseItemStatus(10, 10), "RECEIVED");
});

test("Estatus de OC por recepcion parcial/completa", () => {
  assert.equal(
    resolvePurchaseOrderStatus([
      { quantity: 10, receivedQuantity: 4 },
      { quantity: 5, receivedQuantity: 0 },
    ]),
    "PARTIALLY_RECEIVED"
  );
  assert.equal(
    resolvePurchaseOrderStatus([
      { quantity: 10, receivedQuantity: 10 },
      { quantity: 5, receivedQuantity: 5 },
    ]),
    "COMPLETED"
  );
});

test("Rechazo/cancelacion requieren transicion valida", () => {
  assert.ok(PO_TRANSITIONS.PENDING_APPROVAL.includes("REJECTED"));
  assert.ok(PO_TRANSITIONS.APPROVED.includes("CANCELLED"));
  assert.ok(!PO_TRANSITIONS.COMPLETED.includes("CANCELLED"));
});

test("Permisos etapa 3 existen", () => {
  const needed = [
    "inventory.view",
    "inventory.view_cost",
    "inventory.create_entry",
    "inventory.create_exit",
    "inventory.adjust",
    "inventory.transfer",
    "purchase_orders.view",
    "purchase_orders.create",
    "purchase_orders.approve",
    "purchase_orders.receive",
    "purchase_orders.print",
    "reports.quotations_pdf",
    "reports.production_pdf",
    "reports.inventory_pdf",
    "reports.purchases_pdf",
  ];
  for (const code of needed) {
    assert.ok(ALL_PERMISSION_CODES.includes(code), `Falta ${code}`);
  }
});

test("Codigos de permiso unicos", () => {
  const list = buildPermissionList().map((p) => p.code);
  assert.equal(list.length, new Set(list).size);
});

test("Roles Compras y Almacen tienen permisos etapa 3", () => {
  const compras = SYSTEM_ROLES.find((r) => r.name === "Compras");
  const almacen = SYSTEM_ROLES.find((r) => r.name === "Almacen");
  assert.ok(compras.permissions.includes("purchase_orders.create"));
  assert.ok(almacen.permissions.includes("inventory.create_entry"));
  assert.ok(almacen.permissions.includes("inventory.transfer"));
});

test("Menu muestra inventario con permiso", () => {
  const menu = buildMenu(["inventory.view", "dashboard.view"]);
  const labels = menu.flatMap((s) => s.items.map((i) => i.label));
  assert.ok(labels.includes("Existencias"));
});

// Los reportes PDF quedaron fuera del alcance actual, asi que el permiso no debe abrir
// ninguna entrada de menu; el filtro anyOf se conserva para cuando vuelvan al alcance.
test("Menu no publica reportes PDF y respeta el filtro anyOf", () => {
  const menu = buildMenu(["reports.inventory_pdf", "dashboard.view"]);
  const labels = menu.flatMap((s) => s.items.map((i) => i.label));
  assert.equal(labels.includes("Reportes PDF"), false);
  assert.deepEqual(labels, ["Inicio"]);
  const withAnyOf = NAV_SECTIONS.some((section) =>
    section.items.some((item) => item.anyOf?.length)
  );
  assert.equal(withAnyOf, false);
});
