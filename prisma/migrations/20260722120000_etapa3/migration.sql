-- Etapa 3: inventario, transferencias, ordenes de compra y recepciones

-- AlterEnum FolioScope
ALTER TYPE "folio_scope" ADD VALUE 'INVENTORY_MOVEMENT';
ALTER TYPE "folio_scope" ADD VALUE 'WAREHOUSE_TRANSFER';
ALTER TYPE "folio_scope" ADD VALUE 'PURCHASE_ORDER';
ALTER TYPE "folio_scope" ADD VALUE 'PURCHASE_RECEIPT';

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVATION', 'RELEASE');

CREATE TYPE "movement_reference_type" AS ENUM ('PURCHASE_ORDER', 'PRODUCTION_ORDER', 'PRODUCTION_ITEM', 'DIRECT_ORDER', 'MANUAL_ADJUSTMENT', 'TRANSFER', 'INITIAL_BALANCE');

CREATE TYPE "transfer_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "purchase_order_item_status" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateTable inventory_stock
CREATE TABLE "inventory_stock" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "available_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable inventory_movements
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT,
    "item_id" TEXT NOT NULL,
    "movement_type" "movement_type" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,2),
    "reference_type" "movement_reference_type",
    "reference_id" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable warehouse_transfers
CREATE TABLE "warehouse_transfers" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "requested_by" TEXT,
    "approved_by" TEXT,
    "completed_by" TEXT,
    "requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "warehouse_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable warehouse_transfer_items
CREATE TABLE "warehouse_transfer_items" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "warehouse_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable purchase_orders
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "production_order_id" TEXT,
    "quote_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "authorized_by" TEXT,
    "request_date" DATE NOT NULL,
    "authorization_date" TIMESTAMP(3),
    "expected_date" DATE,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable purchase_order_items
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "description_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "received_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "warehouse_id" TEXT,
    "status" "purchase_order_item_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable purchase_receipts
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "receipt_date" DATE NOT NULL,
    "notes" TEXT,
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable purchase_receipt_items
CREATE TABLE "purchase_receipt_items" (
    "id" TEXT NOT NULL,
    "purchase_receipt_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "ordered_quantity" DECIMAL(14,3) NOT NULL,
    "previously_received_quantity" DECIMAL(14,3) NOT NULL,
    "received_quantity" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "inventory_stock_warehouse_id_item_id_key" ON "inventory_stock"("warehouse_id", "item_id");
CREATE INDEX "inventory_stock_item_id_idx" ON "inventory_stock"("item_id");
CREATE INDEX "inventory_stock_warehouse_id_idx" ON "inventory_stock"("warehouse_id");

CREATE UNIQUE INDEX "inventory_movements_folio_key" ON "inventory_movements"("folio");
CREATE INDEX "inventory_movements_movement_date_idx" ON "inventory_movements"("movement_date");
CREATE INDEX "inventory_movements_warehouse_id_item_id_idx" ON "inventory_movements"("warehouse_id", "item_id");
CREATE INDEX "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");

CREATE UNIQUE INDEX "warehouse_transfers_folio_key" ON "warehouse_transfers"("folio");
CREATE INDEX "warehouse_transfers_status_requested_at_idx" ON "warehouse_transfers"("status", "requested_at");
CREATE INDEX "warehouse_transfers_source_warehouse_id_idx" ON "warehouse_transfers"("source_warehouse_id");
CREATE INDEX "warehouse_transfers_destination_warehouse_id_idx" ON "warehouse_transfers"("destination_warehouse_id");

CREATE INDEX "warehouse_transfer_items_transfer_id_idx" ON "warehouse_transfer_items"("transfer_id");
CREATE INDEX "warehouse_transfer_items_item_id_idx" ON "warehouse_transfer_items"("item_id");

CREATE UNIQUE INDEX "purchase_orders_folio_key" ON "purchase_orders"("folio");
CREATE INDEX "purchase_orders_status_request_date_idx" ON "purchase_orders"("status", "request_date");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_production_order_id_idx" ON "purchase_orders"("production_order_id");
CREATE INDEX "purchase_orders_quote_id_idx" ON "purchase_orders"("quote_id");
CREATE INDEX "purchase_orders_deleted_at_idx" ON "purchase_orders"("deleted_at");

CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "purchase_order_items_item_id_idx" ON "purchase_order_items"("item_id");

CREATE UNIQUE INDEX "purchase_receipts_folio_key" ON "purchase_receipts"("folio");
CREATE INDEX "purchase_receipts_purchase_order_id_idx" ON "purchase_receipts"("purchase_order_id");
CREATE INDEX "purchase_receipts_supplier_id_idx" ON "purchase_receipts"("supplier_id");
CREATE INDEX "purchase_receipts_warehouse_id_idx" ON "purchase_receipts"("warehouse_id");

CREATE INDEX "purchase_receipt_items_purchase_receipt_id_idx" ON "purchase_receipt_items"("purchase_receipt_id");
CREATE INDEX "purchase_receipt_items_purchase_order_item_id_idx" ON "purchase_receipt_items"("purchase_order_item_id");

-- Checks: no negative stock
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_quantity_nonneg" CHECK ("quantity" >= 0);
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_reserved_nonneg" CHECK ("reserved_quantity" >= 0);
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_available_nonneg" CHECK ("available_quantity" >= 0);

-- ForeignKeys
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "warehouse_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
