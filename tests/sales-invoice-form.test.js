import test from "node:test";
import assert from "node:assert/strict";
import {
  invoiceFormDefaultValues,
  invoiceFormQuoteState,
  linkedQuoteItems,
  ORPHANED_QUOTE_MESSAGE,
  serializeInvoiceForClient,
} from "../domains/sales/invoice-form.js";

const quoteItem = {
  id: "qi-1",
  position: 1,
  description: "Pieza E2E-CMT",
  quantity: 2,
  unit: "PZA",
  total: 29667.2,
};

function invoiceWithQuote(overrides = {}) {
  return {
    id: "inv-1",
    invoiceNumber: "E2E-F-001",
    netAmount: 125000,
    invoiceDate: "2026-10-13T00:00:00.000Z",
    sellerId: "u-ventas",
    clientPoNumber: "PO-E2E-1",
    receivedByClient: false,
    receptionDate: null,
    notes: null,
    quotes: [
      {
        quoteId: "q-1",
        quote: {
          id: "q-1",
          folio: "E2E-CMT",
          status: "APPROVED",
          total: 29667.2,
          currency: "MXN",
          client: { commercialName: "Cliente E2E" },
          seller: { id: "u-ventas", name: "E2E Ventas" },
        },
        items: [
          {
            quoteItemId: "qi-1",
            quoteItem,
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("editar factura con cotización hidrata folio, cliente y partidas", () => {
  const state = invoiceFormQuoteState(invoiceWithQuote());
  assert.equal(state.skipQuoteLink, false);
  assert.equal(state.orphanedQuoteLink, false);
  assert.equal(state.selectedQuote.folio, "E2E-CMT");
  assert.equal(state.selectedQuote.clientName, "Cliente E2E");
  assert.equal(state.selectedQuote.items.length, 1);
  assert.equal(state.selectedQuote.items[0].description, "Pieza E2E-CMT");
  assert.deepEqual(state.itemIds, ["qi-1"]);
  assert.ok(Array.isArray(state.selectedQuote.items));
});

test("el estado de edición no deja items indefinido (crash previo)", () => {
  const state = invoiceFormQuoteState(invoiceWithQuote());
  assert.notEqual(state.selectedQuote.items, undefined);
  assert.equal(state.selectedQuote.items.length, 1);
  const values = invoiceFormDefaultValues(invoiceWithQuote(), "u-ventas");
  assert.deepEqual(values.quotes, [{ quoteId: "q-1", quoteItemIds: ["qi-1"] }]);
  assert.equal(values.netAmount, 125000);
  assert.equal(values.invoiceNumber, "E2E-F-001");
});

test("factura sin cotización abre el formulario sin crash y permite skip", () => {
  const state = invoiceFormQuoteState({
    id: "inv-2",
    invoiceNumber: "F-2",
    quotes: [],
  });
  assert.equal(state.selectedQuote, null);
  assert.deepEqual(state.itemIds, []);
  assert.equal(state.skipQuoteLink, true);
  assert.equal(state.orphanedQuoteLink, false);
});

test("vínculo huérfano no crashea y pide relacionar otra cotización", () => {
  const state = invoiceFormQuoteState({
    id: "inv-3",
    quotes: [{ quoteId: "gone", quote: null, items: [] }],
  });
  assert.equal(state.selectedQuote, null);
  assert.equal(state.orphanedQuoteLink, true);
  assert.equal(state.skipQuoteLink, false);
  assert.equal(typeof ORPHANED_QUOTE_MESSAGE, "string");
  assert.match(ORPHANED_QUOTE_MESSAGE, /ya no está disponible/i);
});

test("linkedQuoteItems ignora filas sin id", () => {
  assert.deepEqual(
    linkedQuoteItems({
      items: [{ quoteItemId: null, quoteItem: { description: "x" } }, { quoteItemId: "qi-2" }],
    }),
    [{ id: "qi-2", position: undefined, description: "", quantity: undefined, unit: undefined, total: undefined }]
  );
});

test("serializeInvoiceForClient convierte Decimal y BigInt", () => {
  const plain = serializeInvoiceForClient({
    id: "inv-1",
    netAmount: { toNumber: () => 125000.5 },
    total: { toNumber: () => 29667.2 },
    big: 12n,
    quotes: [
      {
        quote: { total: { toNumber: () => 100 } },
        items: [{ quoteItem: { total: { toNumber: () => 50 } } }],
      },
    ],
  });
  assert.equal(plain.netAmount, 125000.5);
  assert.equal(plain.total, 29667.2);
  assert.equal(plain.big, "12");
  assert.equal(plain.quotes[0].quote.total, 100);
  assert.equal(plain.quotes[0].items[0].quoteItem.total, 50);
});

test("defaultValues convierte Decimal-like de netAmount a número", () => {
  const values = invoiceFormDefaultValues(
    invoiceWithQuote({
      netAmount: { toNumber: () => 125000 },
      invoiceDate: "2026-10-13T00:00:00.000Z",
    }),
    "u-ventas"
  );
  assert.equal(values.netAmount, 125000);
  assert.equal(values.invoiceDate, "2026-10-13");
  assert.equal(values.receivedByClient, false);
  assert.equal(values.receptionDate, null);
});
