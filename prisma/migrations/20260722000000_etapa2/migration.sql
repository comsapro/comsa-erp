-- CreateEnum
CREATE TYPE "process_unit" AS ENUM ('HOUR', 'PIECE', 'LOT', 'METER', 'KILOGRAM', 'SERVICE');

-- CreateEnum
CREATE TYPE "currency_code" AS ENUM ('MXN', 'USD');

-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('GENERAL', 'URGENT', 'WAREHOUSE', 'DIRECT_ORDER_REFERENCE');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "direct_order_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'QUOTED', 'IN_PRODUCTION', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "production_source_type" AS ENUM ('QUOTE', 'DIRECT_ORDER');

-- CreateEnum
CREATE TYPE "production_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "folio_scope" AS ENUM ('QUOTE', 'DIRECT_ORDER', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "delivery_days_type" AS ENUM ('BUSINESS', 'CALENDAR');

-- CreateTable
CREATE TABLE "folio_sequences" (
    "id" TEXT NOT NULL,
    "scope" "folio_scope" NOT NULL,
    "year_month" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folio_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuing_companies" (
    "id" TEXT NOT NULL,
    "commercial_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "rfc" TEXT,
    "fiscal_address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "bank_details" TEXT,
    "legal_text" TEXT,
    "quotation_footer" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "issuing_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_processes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "process_unit" NOT NULL,
    "default_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "manufacturing_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_concepts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "process_unit" NOT NULL,
    "default_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "installation_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "default_quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "delivery_time_min" INTEGER,
    "delivery_time_max" INTEGER,
    "delivery_time_unit" TEXT,
    "delivery_days_type" "delivery_days_type",
    "observations" TEXT,
    "benefit_percentage" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "item_id" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quote_item_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_template_manufacturing" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "manufacturing_process_id" TEXT,
    "process_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" "process_unit" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_template_manufacturing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_template_materials" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "item_id" TEXT,
    "supplier_id" TEXT,
    "description_snapshot" TEXT NOT NULL,
    "dimensions" TEXT,
    "presentation" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_template_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_template_extras" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplier_id" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_template_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_template_installations" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "installation_concept_id" TEXT,
    "concept_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" "process_unit" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_template_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'A',
    "client_id" TEXT NOT NULL,
    "client_contact_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "issuing_company_id" TEXT NOT NULL,
    "order_type" "order_type" NOT NULL DEFAULT 'GENERAL',
    "currency" "currency_code" NOT NULL DEFAULT 'MXN',
    "elaboration_date" DATE NOT NULL,
    "request_date" DATE,
    "valid_until" DATE NOT NULL,
    "purchase_order" TEXT,
    "requisition" TEXT,
    "internal_observations" TEXT,
    "client_design_provided" BOOLEAN NOT NULL DEFAULT false,
    "advance_percentage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "settlement_percentage" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "payment_notes" TEXT,
    "status" "quote_status" NOT NULL DEFAULT 'DRAFT',
    "manufacturing_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materials_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extras_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "installation_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "production_order_id" TEXT,
    "direct_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "template_id" TEXT,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "delivery_time_min" INTEGER,
    "delivery_time_max" INTEGER,
    "delivery_time_unit" TEXT,
    "delivery_days_type" "delivery_days_type",
    "client_observations" TEXT,
    "internal_observations" TEXT,
    "benefit_percentage" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "discount_percentage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "manufacturing_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materials_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extras_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "installation_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sale_subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "warehouse_id" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_manufacturing" (
    "id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,
    "manufacturing_process_id" TEXT,
    "process_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" "process_unit" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_manufacturing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_materials" (
    "id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,
    "item_id" TEXT,
    "supplier_id" TEXT,
    "description_snapshot" TEXT NOT NULL,
    "dimensions" TEXT,
    "presentation" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_extras" (
    "id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplier_id" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item_installations" (
    "id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,
    "installation_concept_id" TEXT,
    "concept_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" "process_unit" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_orders" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "order_type" "order_type" NOT NULL DEFAULT 'GENERAL',
    "client_id" TEXT NOT NULL,
    "client_contact_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "issuing_company_id" TEXT NOT NULL,
    "request_date" DATE NOT NULL,
    "valid_until" DATE,
    "requisition" TEXT,
    "observations" TEXT,
    "status" "direct_order_status" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "production_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "direct_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_order_items" (
    "id" TEXT NOT NULL,
    "direct_order_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "observations" TEXT,
    "benefit_percentage" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "source_type" "production_source_type" NOT NULL,
    "client_id" TEXT NOT NULL,
    "approval_date" DATE NOT NULL,
    "status" "production_status" NOT NULL DEFAULT 'PENDING',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "completed_items" INTEGER NOT NULL DEFAULT 0,
    "progress_percentage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_items" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "source_item_type" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "completed_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "production_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folio_sequences_scope_year_month_key" ON "folio_sequences"("scope", "year_month");

-- CreateIndex
CREATE INDEX "issuing_companies_status_idx" ON "issuing_companies"("status");

-- CreateIndex
CREATE INDEX "issuing_companies_deleted_at_idx" ON "issuing_companies"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_processes_code_key" ON "manufacturing_processes"("code");

-- CreateIndex
CREATE INDEX "manufacturing_processes_status_idx" ON "manufacturing_processes"("status");

-- CreateIndex
CREATE INDEX "manufacturing_processes_deleted_at_idx" ON "manufacturing_processes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "installation_concepts_code_key" ON "installation_concepts"("code");

-- CreateIndex
CREATE INDEX "installation_concepts_status_idx" ON "installation_concepts"("status");

-- CreateIndex
CREATE INDEX "installation_concepts_deleted_at_idx" ON "installation_concepts"("deleted_at");

-- CreateIndex
CREATE INDEX "quote_item_templates_status_idx" ON "quote_item_templates"("status");

-- CreateIndex
CREATE INDEX "quote_item_templates_category_idx" ON "quote_item_templates"("category");

-- CreateIndex
CREATE INDEX "quote_item_templates_deleted_at_idx" ON "quote_item_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "quote_item_template_manufacturing_template_id_idx" ON "quote_item_template_manufacturing"("template_id");

-- CreateIndex
CREATE INDEX "quote_item_template_materials_template_id_idx" ON "quote_item_template_materials"("template_id");

-- CreateIndex
CREATE INDEX "quote_item_template_extras_template_id_idx" ON "quote_item_template_extras"("template_id");

-- CreateIndex
CREATE INDEX "quote_item_template_installations_template_id_idx" ON "quote_item_template_installations"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_folio_key" ON "quotes"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_production_order_id_key" ON "quotes"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_direct_order_id_key" ON "quotes"("direct_order_id");

-- CreateIndex
CREATE INDEX "quotes_status_elaboration_date_idx" ON "quotes"("status", "elaboration_date");

-- CreateIndex
CREATE INDEX "quotes_client_id_idx" ON "quotes"("client_id");

-- CreateIndex
CREATE INDEX "quotes_seller_id_idx" ON "quotes"("seller_id");

-- CreateIndex
CREATE INDEX "quotes_deleted_at_idx" ON "quotes"("deleted_at");

-- CreateIndex
CREATE INDEX "quote_items_quote_id_position_idx" ON "quote_items"("quote_id", "position");

-- CreateIndex
CREATE INDEX "quote_item_manufacturing_quote_item_id_idx" ON "quote_item_manufacturing"("quote_item_id");

-- CreateIndex
CREATE INDEX "quote_item_materials_quote_item_id_idx" ON "quote_item_materials"("quote_item_id");

-- CreateIndex
CREATE INDEX "quote_item_extras_quote_item_id_idx" ON "quote_item_extras"("quote_item_id");

-- CreateIndex
CREATE INDEX "quote_item_installations_quote_item_id_idx" ON "quote_item_installations"("quote_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "direct_orders_folio_key" ON "direct_orders"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "direct_orders_production_order_id_key" ON "direct_orders"("production_order_id");

-- CreateIndex
CREATE INDEX "direct_orders_status_request_date_idx" ON "direct_orders"("status", "request_date");

-- CreateIndex
CREATE INDEX "direct_orders_client_id_idx" ON "direct_orders"("client_id");

-- CreateIndex
CREATE INDEX "direct_orders_seller_id_idx" ON "direct_orders"("seller_id");

-- CreateIndex
CREATE INDEX "direct_orders_deleted_at_idx" ON "direct_orders"("deleted_at");

-- CreateIndex
CREATE INDEX "direct_order_items_direct_order_id_position_idx" ON "direct_order_items"("direct_order_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_folio_key" ON "production_orders"("folio");

-- CreateIndex
CREATE INDEX "production_orders_status_approval_date_idx" ON "production_orders"("status", "approval_date");

-- CreateIndex
CREATE INDEX "production_orders_client_id_idx" ON "production_orders"("client_id");

-- CreateIndex
CREATE INDEX "production_items_production_order_id_position_idx" ON "production_items"("production_order_id", "position");

-- AddForeignKey
ALTER TABLE "quote_item_templates" ADD CONSTRAINT "quote_item_templates_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_manufacturing" ADD CONSTRAINT "quote_item_template_manufacturing_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_manufacturing" ADD CONSTRAINT "quote_item_template_manufacturing_manufacturing_process_id_fkey" FOREIGN KEY ("manufacturing_process_id") REFERENCES "manufacturing_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_materials" ADD CONSTRAINT "quote_item_template_materials_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_materials" ADD CONSTRAINT "quote_item_template_materials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_materials" ADD CONSTRAINT "quote_item_template_materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_extras" ADD CONSTRAINT "quote_item_template_extras_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_extras" ADD CONSTRAINT "quote_item_template_extras_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_installations" ADD CONSTRAINT "quote_item_template_installations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_template_installations" ADD CONSTRAINT "quote_item_template_installations_installation_concept_id_fkey" FOREIGN KEY ("installation_concept_id") REFERENCES "installation_concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_contact_id_fkey" FOREIGN KEY ("client_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_issuing_company_id_fkey" FOREIGN KEY ("issuing_company_id") REFERENCES "issuing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_direct_order_id_fkey" FOREIGN KEY ("direct_order_id") REFERENCES "direct_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_manufacturing" ADD CONSTRAINT "quote_item_manufacturing_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_manufacturing" ADD CONSTRAINT "quote_item_manufacturing_manufacturing_process_id_fkey" FOREIGN KEY ("manufacturing_process_id") REFERENCES "manufacturing_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_materials" ADD CONSTRAINT "quote_item_materials_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_materials" ADD CONSTRAINT "quote_item_materials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_materials" ADD CONSTRAINT "quote_item_materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_extras" ADD CONSTRAINT "quote_item_extras_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_extras" ADD CONSTRAINT "quote_item_extras_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_installations" ADD CONSTRAINT "quote_item_installations_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_installations" ADD CONSTRAINT "quote_item_installations_installation_concept_id_fkey" FOREIGN KEY ("installation_concept_id") REFERENCES "installation_concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_client_contact_id_fkey" FOREIGN KEY ("client_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_issuing_company_id_fkey" FOREIGN KEY ("issuing_company_id") REFERENCES "issuing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_orders" ADD CONSTRAINT "direct_orders_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_order_items" ADD CONSTRAINT "direct_order_items_direct_order_id_fkey" FOREIGN KEY ("direct_order_id") REFERENCES "direct_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_order_items" ADD CONSTRAINT "direct_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_items" ADD CONSTRAINT "production_items_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_items" ADD CONSTRAINT "production_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
