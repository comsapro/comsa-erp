import test from "node:test";
import assert from "node:assert/strict";
import {
  daysSince,
  invoiceListHref,
  parseInvoiceListFilters,
  pendingReceptionSummary,
} from "../domains/sales/invoice-reception.js";
import { salesInvoiceReceptionSchema } from "../domains/sales/schemas.js";
import { SYSTEM_ROLES } from "../lib/permissions/catalog.js";

const TODAY = new Date(2026, 9, 19, 22, 30);

test("daysSince cuenta dias completos desde una fecha @db.Date", () => {
  assert.equal(daysSince("2026-10-19T00:00:00.000Z", TODAY), 0);
  assert.equal(daysSince("2026-10-12T00:00:00.000Z", TODAY), 7);
  assert.equal(daysSince("2026-10-25T00:00:00.000Z", TODAY), 0);
  assert.equal(daysSince(null, TODAY), null);
  assert.equal(daysSince("no-fecha", TODAY), null);
});

test("pendingReceptionSummary con facturas pendientes", () => {
  const summary = pendingReceptionSummary(
    { count: 3, amount: 125000.5, oldestDate: "2026-09-19T00:00:00.000Z" },
    TODAY
  );
  assert.deepEqual(summary, { count: 3, amount: 125000.5, oldestDays: 30 });
});

test("pendingReceptionSummary sin pendientes no arrastra monto ni antiguedad", () => {
  assert.deepEqual(pendingReceptionSummary({ count: 0, amount: null, oldestDate: null }, TODAY), {
    count: 0,
    amount: 0,
    oldestDays: null,
  });
  assert.deepEqual(pendingReceptionSummary(undefined, TODAY), {
    count: 0,
    amount: 0,
    oldestDays: null,
  });
});

test("invoiceListHref arma la liga al filtro de pendientes", () => {
  assert.equal(invoiceListHref(), "/ventas/facturas");
  assert.equal(invoiceListHref({ pendingReception: true }), "/ventas/facturas?pendiente=1");
  assert.equal(
    invoiceListHref({ pendingReception: true, sellerId: "u1" }),
    "/ventas/facturas?pendiente=1&vendedor=u1"
  );
  assert.equal(invoiceListHref({ sellerId: "u1" }), "/ventas/facturas?vendedor=u1");
});

test("parseInvoiceListFilters lee la liga del dashboard (ida y vuelta)", () => {
  const href = invoiceListHref({ pendingReception: true, sellerId: "u1" });
  const params = new URL(href, "http://x").searchParams;
  assert.deepEqual(parseInvoiceListFilters(params), { pendingReception: true, sellerId: "u1" });
});

test("parseInvoiceListFilters acepta el objeto searchParams de una pagina", () => {
  assert.deepEqual(parseInvoiceListFilters({ pendiente: "1" }), {
    pendingReception: true,
    sellerId: "",
  });
  assert.deepEqual(parseInvoiceListFilters({ pendiente: ["1", "0"], vendedor: ["u2"] }), {
    pendingReception: true,
    sellerId: "u2",
  });
  assert.deepEqual(parseInvoiceListFilters({ pendiente: "si" }), {
    pendingReception: false,
    sellerId: "",
  });
  assert.deepEqual(parseInvoiceListFilters(), { pendingReception: false, sellerId: "" });
});

test("marcar recepcion exige fecha", () => {
  const ok = salesInvoiceReceptionSchema.safeParse({
    receivedByClient: true,
    receptionDate: "2026-10-19",
  });
  assert.equal(ok.success, true);
  const missing = salesInvoiceReceptionSchema.safeParse({
    receivedByClient: true,
    receptionDate: "",
  });
  assert.equal(missing.success, false);
});

test("Ventas puede editar facturas y registrar la recepcion", () => {
  const ventas = SYSTEM_ROLES.find((r) => r.name === "Ventas");
  assert.ok(ventas.permissions.includes("sales.edit_invoice"));
  assert.ok(ventas.permissions.includes("sales.create_invoice"));
});

test("Supervisor tambien ve y edita facturas del equipo", () => {
  const supervisor = SYSTEM_ROLES.find((r) => r.name === "Supervisor");
  assert.ok(supervisor.permissions.includes("sales.view"));
  assert.ok(supervisor.permissions.includes("sales.view_team"));
  assert.ok(supervisor.permissions.includes("sales.edit_invoice"));
});
