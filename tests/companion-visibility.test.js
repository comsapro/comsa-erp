import test from "node:test";
import assert from "node:assert/strict";
import {
  companionQuoteVisibleInList,
  isCompanionQuote,
  quoteListCompanionWhere,
} from "../domains/quotes/list-visibility.js";
import {
  VALID_TRANSITIONS,
  directStatusForQuote,
  directOrderSearchOr,
} from "../domains/direct-orders/constants.js";
import {
  directOrderHeaderFromQuote,
  quoteHeaderFromDirectOrder,
} from "../domains/direct-orders/header-sync.js";

test("cotizaciones normales siguen visibles", () => {
  assert.equal(
    companionQuoteVisibleInList({ priceAfterProduction: false, directOrderId: null, status: "DRAFT" }),
    true
  );
});

test("compañera en produccion o borrador no aparece en cotizaciones", () => {
  assert.equal(isCompanionQuote({ priceAfterProduction: true, status: "DRAFT" }), true);
  assert.equal(
    companionQuoteVisibleInList({
      priceAfterProduction: true,
      directOrderId: "do1",
      status: "DRAFT",
    }),
    false
  );
  assert.equal(
    companionQuoteVisibleInList({
      priceAfterProduction: true,
      directOrderId: "do1",
      status: "IN_PRODUCTION",
    }),
    false
  );
});

test("compañera reaparece al supervisor tras produccion", () => {
  for (const status of ["SELLER_REVIEW", "PENDING_APPROVAL", "REJECTED", "APPROVED"]) {
    assert.equal(
      companionQuoteVisibleInList({
        priceAfterProduction: true,
        directOrderId: "do1",
        status,
      }),
      true,
      status
    );
  }
  const where = quoteListCompanionWhere();
  assert.deepEqual(where.OR[1].status.in, [
    "APPROVED",
    "SELLER_REVIEW",
    "PENDING_APPROVAL",
    "REJECTED",
  ]);
});

test("estatus de la orden sigue a la cotizacion compañera", () => {
  assert.equal(directStatusForQuote({ status: "SELLER_REVIEW" }), "IN_PRODUCTION");
  assert.equal(directStatusForQuote({ status: "PENDING_APPROVAL" }), "PENDING_APPROVAL");
  assert.equal(
    directStatusForQuote({ status: "APPROVED", productionOrderId: "op1" }),
    "APPROVED"
  );
  assert.equal(directStatusForQuote({ status: "IN_PRODUCTION" }), "IN_PRODUCTION");
  assert.equal(directStatusForQuote({ status: "DRAFT" }), "DRAFT");
});

test("tras produccion la orden puede volver a pendiente de aprobacion", () => {
  assert.ok(VALID_TRANSITIONS.IN_PRODUCTION.includes("PENDING_APPROVAL"));
});

test("busqueda de ordenes incluye folio de cotizacion y de produccion", () => {
  const or = directOrderSearchOr("2610-10");
  assert.ok(or.some((clause) => clause.quote?.folio?.contains === "2610-10"));
  assert.ok(or.some((clause) => clause.productionOrder?.folio?.contains === "2610-10"));
  assert.ok(or.some((clause) => clause.folio?.contains === "2610-10"));
});

test("cabecera de orden y cotizacion se mapean en ambos sentidos", () => {
  const order = {
    clientId: "c1",
    clientContactId: "ct1",
    sellerId: "s1",
    issuingCompanyId: "co1",
    requestDate: "2026-10-20",
    validUntil: "2026-11-19",
    requisition: "R-1",
    observations: "Notas",
  };
  const quotePatch = quoteHeaderFromDirectOrder(order);
  assert.equal(quotePatch.clientId, "c1");
  assert.equal(quotePatch.elaborationDate, "2026-10-20");
  assert.equal(quotePatch.internalObservations, "Notas");
  assert.equal(quotePatch.requisition, "R-1");

  const back = directOrderHeaderFromQuote({
    ...quotePatch,
    internalObservations: "Notas",
  });
  assert.equal(back.clientId, "c1");
  assert.equal(back.observations, "Notas");
  assert.equal(back.requestDate, "2026-10-20");
});
