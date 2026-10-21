import test from "node:test";
import assert from "node:assert/strict";
import {
  hoursPerPiece,
  manufacturingQuantityFromProduction,
  reportedProductionHours,
} from "../domains/quotes/production-hours.js";
import {
  CLIENT_OBSERVATIONS_MAX,
  quoteItemNoteSchema,
} from "../domains/quotes/observations.js";
import { buildQuotePrintModel } from "../domains/quotes/quote-print.js";

test("las horas de produccion se prorratean por pieza", () => {
  assert.equal(hoursPerPiece(8, 2), 4);
  assert.equal(hoursPerPiece(5, 2), 2.5);
  assert.equal(hoursPerPiece(0, 2), 0);
  assert.equal(hoursPerPiece(3, 0), 3);
});

test("la cotizacion conserva al menos las horas reportadas", () => {
  assert.equal(manufacturingQuantityFromProduction(0, 4), 4);
  assert.equal(manufacturingQuantityFromProduction(6, 4), 6);
  assert.equal(manufacturingQuantityFromProduction(1.5, 1.25), 1.5);
});

test("se toma el cronometro o las horas capturadas, lo que sea mayor", () => {
  const now = new Date("2026-10-21T18:00:00Z");
  const fromTimer = reportedProductionHours(
    {
      realHours: 0,
      sessions: [
        {
          status: "CLOSED",
          durationMinutes: 90,
          accumulatedMinutes: 90,
        },
      ],
    },
    now
  );
  assert.equal(fromTimer, 1.5);

  const typed = reportedProductionHours(
    { realHours: 0, typedHours: 4, sessions: [] },
    now
  );
  assert.equal(typed, 4);

  const keepsHigher = reportedProductionHours(
    {
      realHours: 6,
      sessions: [{ status: "CLOSED", durationMinutes: 60, accumulatedMinutes: 60 }],
    },
    now
  );
  assert.equal(keepsHigher, 6);
});

test("observaciones al cliente de una partida larga si se guardan", () => {
  const long = "comentario de la partida 2. ".repeat(120);
  assert.ok(long.length > 2000);
  assert.ok(long.length < CLIENT_OBSERVATIONS_MAX);
  const parsed = quoteItemNoteSchema.parse(long);
  assert.equal(parsed, long.trim());

  const tooLong = "x".repeat(CLIENT_OBSERVATIONS_MAX + 1);
  assert.equal(quoteItemNoteSchema.safeParse(tooLong).success, false);
});

test("el PDF imprime los comentarios de la partida 2 aunque sean mas largos", () => {
  const comment1 = "Las piezas seran fabricadas en acero inox 304 ".repeat(8);
  const comment2 = "Comentario extra de la partida 2. ".repeat(40);
  const model = buildQuotePrintModel({
    folio: "2610-8-C",
    currency: "MXN",
    items: [
      {
        position: 1,
        description: "Prueba 1",
        quantity: 15,
        status: "ACTIVE",
        clientObservations: comment1,
        saleSubtotal: 1,
      },
      {
        position: 2,
        description: "Prueba 2",
        quantity: 10,
        status: "ACTIVE",
        clientObservations: comment2,
        saleSubtotal: 1,
      },
    ],
  });
  assert.equal(model.items[0].comments, comment1.trim());
  assert.equal(model.items[1].comments, comment2.trim());
  assert.equal(model.items[1].commentsBelow, true);
});
