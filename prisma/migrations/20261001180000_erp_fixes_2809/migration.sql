-- Columnas de material en la orden de compra y eventos manuales del calendario de ventas.

ALTER TABLE "purchase_order_items"
  ADD COLUMN IF NOT EXISTS "dimensions" TEXT,
  ADD COLUMN IF NOT EXISTS "presentation" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_name" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_calendar_event_type') THEN
    CREATE TYPE "sales_calendar_event_type" AS ENUM ('DELIVERY', 'VACATION', 'OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales_calendar_events" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "event_date" DATE NOT NULL,
  "type" "sales_calendar_event_type" NOT NULL DEFAULT 'OTHER',
  "notes" TEXT,
  "user_id" TEXT NOT NULL,
  "team_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "sales_calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sales_calendar_events_event_date_idx" ON "sales_calendar_events"("event_date");
CREATE INDEX IF NOT EXISTS "sales_calendar_events_user_id_idx" ON "sales_calendar_events"("user_id");
CREATE INDEX IF NOT EXISTS "sales_calendar_events_team_id_idx" ON "sales_calendar_events"("team_id");
CREATE INDEX IF NOT EXISTS "sales_calendar_events_deleted_at_idx" ON "sales_calendar_events"("deleted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_calendar_events_user_id_fkey'
  ) THEN
    ALTER TABLE "sales_calendar_events"
      ADD CONSTRAINT "sales_calendar_events_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_calendar_events_team_id_fkey'
  ) THEN
    ALTER TABLE "sales_calendar_events"
      ADD CONSTRAINT "sales_calendar_events_team_id_fkey"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_calendar_events_created_by_fkey'
  ) THEN
    ALTER TABLE "sales_calendar_events"
      ADD CONSTRAINT "sales_calendar_events_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_calendar_events_updated_by_fkey'
  ) THEN
    ALTER TABLE "sales_calendar_events"
      ADD CONSTRAINT "sales_calendar_events_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
