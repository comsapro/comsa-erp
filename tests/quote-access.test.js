import test from "node:test";
import assert from "node:assert/strict";
import {
  canAssignQuoteSeller,
  canSearchQuotesForLink,
  canViewAllQuotes,
} from "../domains/quotes/access-rules.js";
import { assertSellerReviewEdit } from "../domains/quotes/seller-review.js";
import { quoteCanPrint } from "../domains/quotes/constants.js";

const seller = {
  id: "u1",
  roles: [{ name: "Ventas" }],
  permissions: ["quotes.view", "quotes.create", "sales.view"],
};

const supervisor = {
  id: "u2",
  roles: [{ name: "Supervisor" }],
  permissions: ["quotes.view", "quotes.approve", "sales.view_team"],
};

test("compras puede buscar cotizaciones para vincular sin ver todo el modulo", () => {
  const buyer = {
    roles: [{ name: "Compras" }],
    permissions: ["quotes.view", "purchase_orders.create"],
  };
  assert.equal(canViewAllQuotes(buyer), false);
  assert.equal(canSearchQuotesForLink(buyer), true);
  assert.equal(canSearchQuotesForLink(seller), false);
});

test("el vendedor no ve todas las cotizaciones ni asigna vendedor", () => {
  assert.equal(canViewAllQuotes(seller), false);
  assert.equal(canAssignQuoteSeller(seller), false);
});

test("supervisor ve todas y puede asignar vendedor", () => {
  assert.equal(canViewAllQuotes(supervisor), true);
  assert.equal(canAssignQuoteSeller(supervisor), true);
});

test("administrador ve todas aunque no liste el permiso", () => {
  const admin = { roles: [{ name: "Administrador" }], permissions: [] };
  assert.equal(canViewAllQuotes(admin), true);
  assert.equal(canAssignQuoteSeller(admin), true);
});

test("orden directa no se imprime hasta la aprobacion comercial", () => {
  assert.equal(quoteCanPrint({ priceAfterProduction: true, status: "IN_PRODUCTION" }), false);
  assert.equal(quoteCanPrint({ priceAfterProduction: true, status: "SELLER_REVIEW" }), false);
  assert.equal(quoteCanPrint({ priceAfterProduction: true, status: "APPROVED" }), true);
  assert.equal(quoteCanPrint({ priceAfterProduction: false, status: "IN_PRODUCTION" }), true);
});

test("revision del vendedor rechaza quitar un proceso capturado", () => {
  const started = new Date("2026-09-30T12:00:00.000Z");
  const existing = {
    description: "Pieza",
    quantity: 1,
    benefitPercentage: 30,
    discountPercentage: 0,
    manufacturing: [
      {
        id: "m1",
        manufacturingProcessId: "p1",
        quantity: 2,
        unitRate: 100,
        createdAt: new Date("2026-09-30T11:00:00.000Z"),
      },
    ],
    materials: [],
    extras: [],
    installations: [],
  };
  assert.throws(
    () =>
      assertSellerReviewEdit(
        existing,
        {
          id: "item",
          description: "Pieza",
          quantity: 1,
          benefitPercentage: 30,
          discountPercentage: 0,
          manufacturing: [],
          materials: [],
          extras: [],
          installations: [],
        },
        started
      ),
    /quitar un proceso/
  );
});

test("revision del vendedor permite agregar un extra", () => {
  const started = new Date("2026-09-30T12:00:00.000Z");
  const existing = {
    description: "Pieza",
    quantity: 1,
    benefitPercentage: 30,
    discountPercentage: 0,
    manufacturing: [],
    materials: [],
    extras: [],
    installations: [],
  };
  assert.doesNotThrow(() =>
    assertSellerReviewEdit(
      existing,
      {
        id: "item",
        description: "Pieza",
        quantity: 1,
        benefitPercentage: 30,
        discountPercentage: 0,
        manufacturing: [],
        materials: [],
        extras: [{ description: "Flete", quantity: 1, unitPrice: 50 }],
        installations: [],
      },
      started
    )
  );
});
