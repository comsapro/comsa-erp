-- Audiencia de adjuntos (ventas vs produccion) + adjuntos en biblioteca

DO $$ BEGIN
  CREATE TYPE "quote_attachment_audience" AS ENUM ('SALES', 'PRODUCTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quote_item_attachments"
  ADD COLUMN IF NOT EXISTS "audience" "quote_attachment_audience" NOT NULL DEFAULT 'SALES';

CREATE INDEX IF NOT EXISTS "quote_item_attachments_audience_idx"
  ON "quote_item_attachments"("audience");

CREATE TABLE IF NOT EXISTS "quote_item_template_attachments" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "url" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "audience" "quote_attachment_audience" NOT NULL DEFAULT 'SALES',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "quote_item_template_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_item_template_attachments_pathname_key"
  ON "quote_item_template_attachments"("pathname");

CREATE INDEX IF NOT EXISTS "quote_item_template_attachments_template_id_idx"
  ON "quote_item_template_attachments"("template_id");

DO $$ BEGIN
  ALTER TABLE "quote_item_template_attachments"
    ADD CONSTRAINT "quote_item_template_attachments_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "quote_item_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
