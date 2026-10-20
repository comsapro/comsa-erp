import { toDateInputValue } from "../../lib/utils/format.js";

function toPlainNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function serializeInvoiceForClient(invoice) {
  if (!invoice) return null;
  return JSON.parse(
    JSON.stringify(invoice, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value && typeof value === "object" && typeof value.toNumber === "function") {
        return value.toNumber();
      }
      return value;
    })
  );
}

export function linkedQuoteItems(link) {
  return (link?.items || [])
    .map((row) => {
      const source = row.quoteItem || {};
      const id = row.quoteItemId || source.id;
      if (!id) return null;
      return {
        id,
        position: source.position,
        description: source.description || "",
        quantity: source.quantity,
        unit: source.unit,
        total: source.total,
      };
    })
    .filter(Boolean);
}

export function invoiceFormQuoteState(invoice) {
  if (!invoice) {
    return {
      selectedQuote: null,
      itemIds: [],
      skipQuoteLink: false,
      orphanedQuoteLink: false,
    };
  }

  const links = invoice.quotes || [];
  if (!links.length) {
    return {
      selectedQuote: null,
      itemIds: [],
      skipQuoteLink: true,
      orphanedQuoteLink: false,
    };
  }

  const link = links[0];
  if (!link.quote?.id) {
    return {
      selectedQuote: null,
      itemIds: [],
      skipQuoteLink: false,
      orphanedQuoteLink: true,
    };
  }

  const items = linkedQuoteItems(link);
  return {
    selectedQuote: {
      id: link.quote.id,
      folio: link.quote.folio,
      status: link.quote.status,
      total: link.quote.total,
      currency: link.quote.currency || "MXN",
      clientName: link.quote.client?.commercialName || "",
      client: link.quote.client || null,
      seller: link.quote.seller || null,
      items,
    },
    itemIds: items.map((item) => item.id),
    skipQuoteLink: false,
    orphanedQuoteLink: false,
  };
}

export function invoiceFormDefaultValues(invoice, currentUserId) {
  const quoteState = invoiceFormQuoteState(invoice);
  const netAmount = toPlainNumber(invoice?.netAmount);
  return {
    invoiceNumber: invoice?.invoiceNumber || "",
    netAmount: netAmount != null ? netAmount : "",
    invoiceDate: toDateInputValue(
      invoice?.invoiceDate ? new Date(invoice.invoiceDate) : new Date()
    ),
    sellerId: invoice?.sellerId || currentUserId || "",
    clientPoNumber: invoice?.clientPoNumber || "",
    receivedByClient: Boolean(invoice?.receivedByClient),
    receptionDate: invoice?.receptionDate
      ? toDateInputValue(new Date(invoice.receptionDate))
      : null,
    notes: invoice?.notes || "",
    quotes:
      !quoteState.skipQuoteLink && quoteState.selectedQuote && quoteState.itemIds.length
        ? [{ quoteId: quoteState.selectedQuote.id, quoteItemIds: quoteState.itemIds }]
        : [],
  };
}

export const ORPHANED_QUOTE_MESSAGE =
  "La cotización ligada a esta factura ya no está disponible. Relaciona otra cotización para guardar los cambios.";
