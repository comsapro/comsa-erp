import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuoteItemTotals,
  calculateQuoteHeaderTotals,
  itemQuantity,
  TAX_RATE,
  money,
} from "../lib/quotes/calculations.js";
import { buildQuotePrintModel, lineUnitPrice } from "../domains/quotes/quote-print.js";
import { isLegacyQuote } from "../domains/quotes/constants.js";
import {
  planQuoteQuantityRecalc,
  recalcDecision,
} from "../lib/quotes/quantity-recalc.js";

// Partida del caso reportado: $17,050 por pieza, 15 piezas.
const perPieceLines = {
  manufacturing: [{ amount: 12500 }],
  materials: [{ amount: 3000 }],
  extras: [{ amount: 500 }],
  installations: [],
  benefitPercentage: 30,
};

test("una pieza de la partida del caso reportado vale $17,050", () => {
  const totals = calculateQuoteItemTotals({ ...perPieceLines, quantity: 1 });
  assert.equal(totals.unitSalePrice, 17050);
  assert.equal(totals.saleSubtotal, 17050);
});

test("15 piezas x $17,050 = $255,750 + IVA", () => {
  const totals = calculateQuoteItemTotals({ ...perPieceLines, quantity: 15 });
  assert.equal(totals.unitSalePrice, 17050);
  assert.equal(totals.saleSubtotal, 255750);
  assert.equal(totals.taxAmount, 40920);
  assert.equal(totals.total, 296670);
});

test("costos y beneficio de la partida se multiplican por cantidad", () => {
  const totals = calculateQuoteItemTotals({ ...perPieceLines, quantity: 15 });
  assert.equal(totals.manufacturingTotal, 12500 * 15);
  assert.equal(totals.materialsTotal, 3000 * 15);
  assert.equal(totals.extrasTotal, 500 * 15);
  assert.equal(totals.costTotal, 16000 * 15);
  assert.equal(totals.materialsBenefitAmount, 900 * 15);
  assert.equal(totals.extrasBenefitAmount, 150 * 15);
});

test("el descuento se aplica sobre el subtotal de todas las piezas", () => {
  const totals = calculateQuoteItemTotals({
    manufacturing: [{ amount: 100 }],
    benefitPercentage: 0,
    discountPercentage: 10,
    quantity: 3,
  });
  assert.equal(totals.saleSubtotal, 300);
  assert.equal(totals.discountAmount, 30);
  assert.equal(totals.taxAmount, money(270 * TAX_RATE));
  assert.equal(totals.total, money(270 + 270 * TAX_RATE));
});

test("precio unitario x cantidad cuadra exacto con el importe aun con decimales", () => {
  const totals = calculateQuoteItemTotals({
    manufacturing: [{ amount: 33.33 }],
    benefitPercentage: 0,
    quantity: 7,
  });
  assert.equal(totals.unitSalePrice, 33.33);
  assert.equal(totals.saleSubtotal, money(33.33 * 7));
});

test("cantidad vacia, cero o negativa cuenta como una pieza", () => {
  assert.equal(itemQuantity(undefined), 1);
  assert.equal(itemQuantity(0), 1);
  assert.equal(itemQuantity(-2), 1);
  assert.equal(itemQuantity("2.5"), 2.5);
});

test("legacy: las lineas ya son el total de la partida y no se multiplican", () => {
  const totals = calculateQuoteItemTotals({
    ...perPieceLines,
    quantity: 15,
    perPiece: false,
  });
  assert.equal(totals.saleSubtotal, 17050);
  assert.equal(totals.unitSalePrice, money(17050 / 15));
});

test("la cabecera suma los importes ya multiplicados", () => {
  const a = calculateQuoteItemTotals({ ...perPieceLines, quantity: 15 });
  const b = calculateQuoteItemTotals({
    manufacturing: [{ amount: 100 }],
    benefitPercentage: 0,
    quantity: 2,
  });
  const header = calculateQuoteHeaderTotals([a, b]);
  assert.equal(header.subtotal, 255950);
  assert.equal(header.total, money(a.total + b.total));
});

test("isLegacyQuote detecta el marcador de importacion", () => {
  assert.equal(isLegacyQuote({ internalObservations: "[legacy:ABC] nota" }), true);
  assert.equal(isLegacyQuote({ internalObservations: "nota" }), false);
  assert.equal(isLegacyQuote({}), false);
});

test("el PDF muestra precio por pieza y el importe de las 15 piezas", () => {
  const totals = calculateQuoteItemTotals({ ...perPieceLines, quantity: 15 });
  const quote = {
    folio: "2610-8-A",
    currency: "MXN",
    subtotal: totals.saleSubtotal,
    taxTotal: totals.taxAmount,
    total: totals.total,
    items: [
      {
        position: 1,
        description: "Prueba",
        quantity: 15,
        status: "ACTIVE",
        unitSalePrice: totals.unitSalePrice,
        saleSubtotal: totals.saleSubtotal,
        discountAmount: 0,
      },
    ],
  };
  const model = buildQuotePrintModel(quote);
  assert.equal(model.items[0].unitPrice, "$17,050.00");
  assert.equal(model.items[0].quantity, "15.00");
  assert.equal(model.items[0].amount, "$255,750.00");
  assert.equal(model.totals.subtotal, "$255,750.00");
  assert.equal(model.totals.total, "$296,670.00");
});

test("partidas sin unitSalePrice (anteriores o legacy) dividen el importe", () => {
  assert.equal(lineUnitPrice({ quantity: 15, saleSubtotal: 17050 }), 17050 / 15);
  assert.equal(
    lineUnitPrice({ quantity: 15, saleSubtotal: 255750, unitSalePrice: 17050 }),
    17050
  );
});

function storedQuote(status, total) {
  return {
    status,
    total,
    items: [
      {
        id: "i1",
        status: "ACTIVE",
        quantity: 15,
        benefitPercentage: 30,
        discountPercentage: 0,
        manufacturing: [{ amount: 12500 }],
        materials: [{ amount: 3000 }],
        extras: [{ amount: 500 }],
        installations: [],
      },
    ],
  };
}

test("recalculo: borradores y pendientes se corrigen", () => {
  for (const status of ["DRAFT", "PENDING_APPROVAL"]) {
    const quote = storedQuote(status, 19778);
    const plan = planQuoteQuantityRecalc(quote);
    assert.equal(plan.changed, true);
    assert.equal(plan.newTotal, 296670);
    assert.equal(plan.items[0].data.unitSalePrice, 17050);
    assert.equal(recalcDecision(quote, plan), "apply");
  }
});

test("recalculo: aprobadas con diferencia solo se reportan", () => {
  for (const status of ["APPROVED", "IN_PRODUCTION", "SELLER_REVIEW", "REJECTED"]) {
    const quote = storedQuote(status, 19778);
    const plan = planQuoteQuantityRecalc(quote);
    assert.equal(recalcDecision(quote, plan), "report");
  }
});

test("recalculo: sin diferencia solo se guarda el precio por pieza", () => {
  const quote = storedQuote("APPROVED", 296670);
  const plan = planQuoteQuantityRecalc(quote);
  assert.equal(plan.changed, false);
  assert.equal(recalcDecision(quote, plan), "backfill");
});

test("recalculo: partidas inactivas no suman al total", () => {
  const quote = storedQuote("DRAFT", 0);
  quote.items.push({ ...quote.items[0], id: "i2", status: "INACTIVE" });
  const plan = planQuoteQuantityRecalc(quote);
  assert.equal(plan.newTotal, 296670);
});
