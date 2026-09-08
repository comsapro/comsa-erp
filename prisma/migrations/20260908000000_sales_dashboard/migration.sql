-- CreateEnum
CREATE TYPE "sales_goal_period" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "material_skip_reason" AS ENUM ('IN_STOCK', 'CLIENT_PROVIDED', 'USE_SURPLUS', 'NOT_APPLICABLE', 'OTHER');

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goals" (
    "id" TEXT NOT NULL,
    "period" "sales_goal_period" NOT NULL,
    "period_key" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_sellers" (
    "sales_goal_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,

    CONSTRAINT "sales_goal_sellers_pkey" PRIMARY KEY ("sales_goal_id","seller_id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "seller_id" TEXT NOT NULL,
    "client_po_number" TEXT NOT NULL,
    "received_by_client" BOOLEAN NOT NULL DEFAULT false,
    "reception_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_quotes" (
    "id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,

    CONSTRAINT "sales_invoice_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_quote_items" (
    "id" TEXT NOT NULL,
    "sales_invoice_quote_id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,

    CONSTRAINT "sales_invoice_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_purchase_decisions" (
    "id" TEXT NOT NULL,
    "quote_item_material_id" TEXT NOT NULL,
    "will_purchase" BOOLEAN NOT NULL,
    "skip_reason" "material_skip_reason",
    "observations" TEXT,
    "decided_by" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "material_purchase_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goals_period_period_key_key" ON "sales_goals"("period", "period_key");

-- CreateIndex
CREATE INDEX "sales_goals_deleted_at_idx" ON "sales_goals"("deleted_at");

-- CreateIndex
CREATE INDEX "sales_goal_sellers_seller_id_idx" ON "sales_goal_sellers"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_invoice_number_key" ON "sales_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "sales_invoices_seller_id_invoice_date_idx" ON "sales_invoices"("seller_id", "invoice_date");

-- CreateIndex
CREATE INDEX "sales_invoices_received_by_client_idx" ON "sales_invoices"("received_by_client");

-- CreateIndex
CREATE INDEX "sales_invoices_deleted_at_idx" ON "sales_invoices"("deleted_at");

-- CreateIndex
CREATE INDEX "sales_invoice_quotes_quote_id_idx" ON "sales_invoice_quotes"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_quotes_sales_invoice_id_quote_id_key" ON "sales_invoice_quotes"("sales_invoice_id", "quote_id");

-- CreateIndex
CREATE INDEX "sales_invoice_quote_items_quote_item_id_idx" ON "sales_invoice_quote_items"("quote_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_quote_items_sales_invoice_quote_id_quote_item_id_key" ON "sales_invoice_quote_items"("sales_invoice_quote_id", "quote_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_purchase_decisions_quote_item_material_id_key" ON "material_purchase_decisions"("quote_item_material_id");

-- CreateIndex
CREATE INDEX "material_purchase_decisions_will_purchase_idx" ON "material_purchase_decisions"("will_purchase");

-- AddForeignKey
ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_sellers" ADD CONSTRAINT "sales_goal_sellers_sales_goal_id_fkey" FOREIGN KEY ("sales_goal_id") REFERENCES "sales_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_sellers" ADD CONSTRAINT "sales_goal_sellers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_quotes" ADD CONSTRAINT "sales_invoice_quotes_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_quotes" ADD CONSTRAINT "sales_invoice_quotes_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_quote_items" ADD CONSTRAINT "sales_invoice_quote_items_sales_invoice_quote_id_fkey" FOREIGN KEY ("sales_invoice_quote_id") REFERENCES "sales_invoice_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_quote_items" ADD CONSTRAINT "sales_invoice_quote_items_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_purchase_decisions" ADD CONSTRAINT "material_purchase_decisions_quote_item_material_id_fkey" FOREIGN KEY ("quote_item_material_id") REFERENCES "quote_item_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_purchase_decisions" ADD CONSTRAINT "material_purchase_decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
