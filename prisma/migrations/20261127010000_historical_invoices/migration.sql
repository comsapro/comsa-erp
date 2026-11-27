-- Historico de facturacion importado del consecutivo de facturas (Excel).
-- CreateTable
CREATE TABLE "historical_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "invoice_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'NUM',
    "is_resale" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "client_name" TEXT NOT NULL,
    "client_id" TEXT,
    "seller_alias" TEXT,
    "seller_id" TEXT,
    "description" TEXT,
    "po_number" TEXT,
    "order_ref" TEXT,
    "labor_amount" DECIMAL(14,2),
    "notes" TEXT,
    "source_sheet" TEXT NOT NULL,
    "date_estimated" BOOLEAN NOT NULL DEFAULT false,
    "quote_id" TEXT,
    "link_method" TEXT,
    "linked_at" TIMESTAMP(3),
    "linked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_invoices_invoice_date_idx" ON "historical_invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "historical_invoices_client_id_idx" ON "historical_invoices"("client_id");

-- CreateIndex
CREATE INDEX "historical_invoices_quote_id_idx" ON "historical_invoices"("quote_id");

-- CreateIndex
CREATE INDEX "historical_invoices_po_number_idx" ON "historical_invoices"("po_number");

-- CreateIndex
CREATE UNIQUE INDEX "historical_invoices_invoice_number_year_key" ON "historical_invoices"("invoice_number", "year");

-- AddForeignKey
ALTER TABLE "historical_invoices" ADD CONSTRAINT "historical_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_invoices" ADD CONSTRAINT "historical_invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_invoices" ADD CONSTRAINT "historical_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

