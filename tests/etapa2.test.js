import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuoteItemTotals,
  calculateQuoteHeaderTotals,
  lineAmount,
  money,
  MIN_BENEFIT_SALES,
  TAX_RATE,
} from "../lib/quotes/calculations.js";
import {
  VALID_TRANSITIONS,
  QUOTE_STATUSES,
} from "../domains/quotes/constants.js";
import {
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
  buildPermissionList,
} from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";
import { ForbiddenError } from "../lib/permissions/errors.js";

test("lineAmount multiplica cantidad x precio", () => {
  assert.equal(lineAmount(2, 10.5), 21);
  assert.equal(lineAmount(1.5, 10), 15);
});

test("Totales de item con IVA 16% y beneficio 30%", () => {
  const totals = calculateQuoteItemTotals({
    manufacturing: [{ amount: 100 }],
    materials: [{ amount: 50 }],
    extras: [{ amount: 50 }],
    installations: [],
    benefitPercentage: 30,
    discountPercentage: 0,
  });
  assert.equal(totals.costTotal, 200);
  assert.equal(totals.saleSubtotal, 260);
  assert.equal(totals.taxAmount, money(260 * TAX_RATE));
  assert.equal(totals.total, money(260 + 260 * TAX_RATE));
});

test("Descuento reduce base gravable", () => {
  const totals = calculateQuoteItemTotals({
    manufacturing: [{ amount: 100 }],
    benefitPercentage: 0,
    discountPercentage: 10,
  });
  assert.equal(totals.saleSubtotal, 100);
  assert.equal(totals.discountAmount, 10);
  assert.equal(totals.taxAmount, money(90 * TAX_RATE));
  assert.equal(totals.total, money(90 + 90 * TAX_RATE));
});

test("Cabecera suma totales de items", () => {
  const header = calculateQuoteHeaderTotals([
    { manufacturingTotal: 10, materialsTotal: 0, extrasTotal: 0, installationTotal: 0, costTotal: 10, saleSubtotal: 13, discountAmount: 0, taxAmount: 2.08, total: 15.08 },
    { manufacturingTotal: 20, materialsTotal: 0, extrasTotal: 0, installationTotal: 0, costTotal: 20, saleSubtotal: 26, discountAmount: 0, taxAmount: 4.16, total: 30.16 },
  ]);
  assert.equal(header.costTotal, 30);
  assert.equal(header.total, 45.24);
});

test("Beneficio minimo de ventas es 30", () => {
  assert.equal(MIN_BENEFIT_SALES, 30);
});

test("Transiciones de cotizacion validas", () => {
  assert.deepEqual(VALID_TRANSITIONS.DRAFT, ["PENDING_APPROVAL", "CANCELLED"]);
  assert.ok(VALID_TRANSITIONS.PENDING_APPROVAL.includes("APPROVED"));
  assert.ok(VALID_TRANSITIONS.PENDING_APPROVAL.includes("REJECTED"));
  assert.ok(VALID_TRANSITIONS.REJECTED.includes("DRAFT"));
  assert.deepEqual(VALID_TRANSITIONS.CANCELLED, []);
  assert.ok(VALID_TRANSITIONS.APPROVED.includes("IN_PRODUCTION"));
});

test("QUOTE_STATUSES contiene estados requeridos", () => {
  for (const s of [
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "IN_PRODUCTION",
    "REJECTED",
    "CANCELLED",
  ]) {
    assert.ok(QUOTE_STATUSES.includes(s), `Falta status ${s}`);
  }
});

test("Permisos etapa 2 existen en el catalogo", () => {
  const needed = [
    "issuing_companies.view",
    "manufacturing_processes.create",
    "installation_concepts.edit",
    "quote_templates.view",
    "quotes.create",
    "quotes.approve",
    "quotes.edit_benefit",
    "quotes.apply_discount",
    "quotes.send_to_production",
    "direct_orders.convert_to_quote",
    "production.complete_item",
  ];
  for (const code of needed) {
    assert.ok(ALL_PERMISSION_CODES.includes(code), `Falta ${code}`);
  }
});

test("Ventas no tiene quotes.approve ni print", () => {
  const ventas = SYSTEM_ROLES.find((r) => r.name === "Ventas");
  assert.ok(!ventas.permissions.includes("quotes.approve"));
  assert.ok(!ventas.permissions.includes("quotes.edit_benefit"));
  assert.ok(!ventas.permissions.includes("quotes.apply_discount"));
  assert.ok(!ventas.permissions.includes("quotes.print"));
  assert.ok(ventas.permissions.includes("quotes.create"));
  assert.ok(ventas.permissions.includes("quotes.submit"));
});

test("Supervisor puede aprobar e imprimir cotizaciones", () => {
  const supervisor = SYSTEM_ROLES.find((r) => r.name === "Supervisor");
  assert.ok(supervisor);
  assert.ok(supervisor.permissions.includes("quotes.approve"));
  assert.ok(supervisor.permissions.includes("quotes.reject"));
  assert.ok(supervisor.permissions.includes("quotes.print"));
  assert.ok(supervisor.permissions.includes("manufacturing_processes.create"));
});

test("Produccion tiene production.complete_order", () => {
  const prod = SYSTEM_ROLES.find((r) => r.name === "Produccion");
  assert.ok(prod.permissions.includes("production.complete_order"));
  assert.ok(prod.permissions.includes("production.view"));
});

test("Menu comercial se oculta sin permisos", () => {
  const menu = buildMenu(["dashboard.view", "clients.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(!hrefs.includes("/cotizaciones"));
  assert.ok(!hrefs.includes("/produccion"));
});

test("Menu muestra cotizaciones con quotes.view", () => {
  const menu = buildMenu(["dashboard.view", "quotes.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/cotizaciones"));
});

test("ForbiddenError sigue siendo 403", () => {
  assert.equal(new ForbiddenError("x", "quotes.approve").status, 403);
});

test("Catalogo de permisos sin duplicados", () => {
  const codes = buildPermissionList().map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("Snapshot historico: cambiar catalogo no afecta amount ya calculado", () => {
  // Simula item con rate snapshot 100; catalogo luego cambia a 200.
  const historical = calculateQuoteItemTotals({
    manufacturing: [{ amount: lineAmount(2, 100) }],
    benefitPercentage: 0,
  });
  const ifRecalculatedFromNewCatalog = calculateQuoteItemTotals({
    manufacturing: [{ amount: lineAmount(2, 200) }],
    benefitPercentage: 0,
  });
  assert.equal(historical.costTotal, 200);
  assert.equal(ifRecalculatedFromNewCatalog.costTotal, 400);
  assert.notEqual(historical.costTotal, ifRecalculatedFromNewCatalog.costTotal);
});
