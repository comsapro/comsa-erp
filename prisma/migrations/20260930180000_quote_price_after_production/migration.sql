-- Orden directa cotizada despues de producir.
ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'SELLER_REVIEW';

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "price_after_production" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seller_review_started_at" TIMESTAMP(3);
