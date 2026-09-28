-- Drop global unique on sales goals period (allow one goal per team/seller)
DROP INDEX IF EXISTS "sales_goals_period_period_key_key";

-- Non-unique index for period lookups
CREATE INDEX IF NOT EXISTS "sales_goals_period_period_key_idx" ON "sales_goals"("period", "period_key");

-- Allow purchase order lines without catalog item (manual description-only lines)
ALTER TABLE "purchase_order_items" ALTER COLUMN "item_id" DROP NOT NULL;
