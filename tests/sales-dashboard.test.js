import test from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays,
  deliveryDaysFromQuoteItem,
  formatDateKey,
  isWeekendUtc,
} from "../lib/calendar/business-days.js";
import {
  periodKeyFor,
  periodRange,
  SALES_GOAL_PERIODS,
} from "../domains/sales/constants.js";
import {
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
  buildPermissionList,
} from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";

test("addBusinessDays salta fines de semana", () => {
  // Viernes 2026-09-04 + 1 día hábil = lunes 2026-09-07
  const start = new Date(Date.UTC(2026, 8, 4));
  const result = addBusinessDays(start, 1, []);
  assert.equal(formatDateKey(result), "2026-09-07");
});

test("addBusinessDays salta festivos", () => {
  // Jueves 2026-09-15 + 1, con festivo el 16 = viernes 17
  const start = new Date(Date.UTC(2026, 8, 15));
  const result = addBusinessDays(start, 1, ["2026-09-16"]);
  assert.equal(formatDateKey(result), "2026-09-17");
});

test("isWeekendUtc reconoce sábado y domingo", () => {
  assert.equal(isWeekendUtc(new Date(Date.UTC(2026, 8, 5))), true);
  assert.equal(isWeekendUtc(new Date(Date.UTC(2026, 8, 6))), true);
  assert.equal(isWeekendUtc(new Date(Date.UTC(2026, 8, 7))), false);
});

test("deliveryDaysFromQuoteItem convierte semanas a días hábiles", () => {
  assert.equal(
    deliveryDaysFromQuoteItem({
      deliveryTimeMax: 2,
      deliveryTimeUnit: "WEEK",
    }),
    10
  );
  assert.equal(
    deliveryDaysFromQuoteItem({
      deliveryTimeMin: 5,
      deliveryTimeUnit: "DAY",
    }),
    5
  );
});

test("periodKeyFor y periodRange mensuales", () => {
  const key = periodKeyFor(SALES_GOAL_PERIODS.MONTHLY, new Date(2026, 8, 7));
  assert.equal(key, "2026-09");
  const range = periodRange(SALES_GOAL_PERIODS.MONTHLY, key);
  assert.equal(range.from.getFullYear(), 2026);
  assert.equal(range.from.getMonth(), 8);
  assert.equal(range.to.getMonth(), 8);
});

test("catalogo incluye permisos de sales", () => {
  const codes = new Set(buildPermissionList().map((p) => p.code));
  assert.ok(codes.has("sales.view"));
  assert.ok(codes.has("sales.manage_goals"));
  assert.ok(codes.has("sales.create_invoice"));
  assert.ok(codes.has("sales.edit_commitment"));
  assert.ok(codes.has("sales.view_team"));
});

test("rol Ventas incluye sales.view y create_invoice", () => {
  const ventas = SYSTEM_ROLES.find((r) => r.name === "Ventas");
  assert.ok(ventas.permissions.includes("sales.view"));
  assert.ok(ventas.permissions.includes("sales.create_invoice"));
  assert.ok(!ventas.permissions.includes("sales.manage_goals"));
});

test("menu muestra dashboard de ventas con permiso", () => {
  const menu = buildMenu(["dashboard.view", "sales.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/ventas"));
  assert.ok(hrefs.includes("/"));
});

test("ALL_PERMISSION_CODES incluye sales", () => {
  assert.ok(ALL_PERMISSION_CODES.includes("sales.view"));
});
