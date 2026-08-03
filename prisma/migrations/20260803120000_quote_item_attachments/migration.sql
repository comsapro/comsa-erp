-- Adjuntos / imagenes por partida de cotizacion (Vercel Blob privado)

CREATE TABLE IF NOT EXISTS "quote_item_attachments" (
    "id" TEXT NOT NULL,
    "quote_item_id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "url" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "quote_item_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_item_attachments_pathname_key"
  ON "quote_item_attachments"("pathname");

CREATE INDEX IF NOT EXISTS "quote_item_attachments_quote_item_id_idx"
  ON "quote_item_attachments"("quote_item_id");

DO $$ BEGIN
  ALTER TABLE "quote_item_attachments"
    ADD CONSTRAINT "quote_item_attachments_quote_item_id_fkey"
    FOREIGN KEY ("quote_item_id") REFERENCES "quote_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "quote_item_attachments"
    ADD CONSTRAINT "quote_item_attachments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
