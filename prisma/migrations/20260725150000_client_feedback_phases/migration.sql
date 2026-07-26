-- Fase 2/3: multi-OP por cotización, revisiones, material listo, bitácora y duración

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "parent_quote_id" TEXT;
CREATE INDEX IF NOT EXISTS "quotes_parent_quote_id_idx" ON "quotes"("parent_quote_id");

DO $$ BEGIN
  ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_parent_quote_id_fkey"
    FOREIGN KEY ("parent_quote_id") REFERENCES "quotes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "origin_item_id" TEXT;

ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "quote_id" TEXT;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "materials_ready_at" TIMESTAMP(3);
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "materials_ready_by" TEXT;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "reprint_of_id" TEXT;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "reprint_reason" TEXT;

CREATE INDEX IF NOT EXISTS "production_orders_quote_id_idx" ON "production_orders"("quote_id");

-- Backfill quote_id from quotes.production_order_id
UPDATE "production_orders" po
SET "quote_id" = q.id
FROM "quotes" q
WHERE q.production_order_id = po.id
  AND po.quote_id IS NULL;

DO $$ BEGIN
  ALTER TABLE "production_orders"
    ADD CONSTRAINT "production_orders_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "quotes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "production_orders"
    ADD CONSTRAINT "production_orders_materials_ready_by_fkey"
    FOREIGN KEY ("materials_ready_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "production_orders"
    ADD CONSTRAINT "production_orders_reprint_of_id_fkey"
    FOREIGN KEY ("reprint_of_id") REFERENCES "production_orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "production_items" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;
CREATE INDEX IF NOT EXISTS "production_items_source_item_id_idx" ON "production_items"("source_item_id");

CREATE TABLE IF NOT EXISTS "production_item_notes" (
  "id" TEXT NOT NULL,
  "production_item_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_item_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "production_item_notes_production_item_id_created_at_idx"
  ON "production_item_notes"("production_item_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "production_item_notes"
    ADD CONSTRAINT "production_item_notes_production_item_id_fkey"
    FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "production_item_notes"
    ADD CONSTRAINT "production_item_notes_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrar observaciones existentes a primera nota de bitácora
INSERT INTO "production_item_notes" ("id", "production_item_id", "body", "created_by", "created_at")
SELECT
  md5(random()::text || clock_timestamp()::text),
  pi.id,
  pi.observations,
  pi.completed_by,
  COALESCE(pi.updated_at, pi.created_at)
FROM "production_items" pi
WHERE pi.observations IS NOT NULL
  AND TRIM(pi.observations) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "production_item_notes" n WHERE n.production_item_id = pi.id
  );
