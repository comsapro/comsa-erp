export const COMPANION_QUOTE_LIST_STATUSES = [
  "APPROVED",
  "SELLER_REVIEW",
  "PENDING_APPROVAL",
  "REJECTED",
];

export function isCompanionQuote(quote) {
  return Boolean(quote?.priceAfterProduction || quote?.directOrderId);
}

export function companionQuoteVisibleInList(quote) {
  if (!isCompanionQuote(quote)) return true;
  return COMPANION_QUOTE_LIST_STATUSES.includes(quote?.status);
}

export function quoteListCompanionWhere() {
  return {
    OR: [
      {
        AND: [{ priceAfterProduction: false }, { directOrderId: null }],
      },
      { status: { in: COMPANION_QUOTE_LIST_STATUSES } },
    ],
  };
}
