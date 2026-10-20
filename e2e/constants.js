export const E2E_PASSWORD = "E2ePass123!";

export const USERS = {
  admin: {
    name: "E2E Admin",
    email: "e2e.admin@comsa.test",
    role: "Administrador",
  },
  supervisor: {
    name: "E2E Supervisor",
    email: "e2e.supervisor@comsa.test",
    role: "Supervisor",
  },
  ventas: {
    name: "E2E Ventas",
    email: "e2e.ventas@comsa.test",
    role: "Ventas",
  },
  compras: {
    name: "E2E Compras",
    email: "e2e.compras@comsa.test",
    role: "Compras",
  },
};

export const FOLIOS = {
  qtyQuote: "E2E-QTY",
  commentQuote: "E2E-CMT",
  searchQuote: "E2E-SRCH",
  prodQuote: "E2E-PROD",
  production: "E2E-OP",
  pendingPo: "E2E-PO",
  directOrder: "E2E-DO",
  directQuote: "E2E-DOQ",
};

export const INVOICE_NUMBER = "E2E-F-001";
export const COMMENT_TOKEN = "E2E-COMENTARIO-LARGO";
export const LONG_COMMENT = `${COMMENT_TOKEN} ${"pieza con acabado especial. ".repeat(80)}`.trim();

export const QTY_SUBTOTAL = "$255,750.00";
