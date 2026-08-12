-- CreateTable
CREATE TABLE "production_attachments" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "url" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCAN',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "production_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_attachments_production_order_id_idx" ON "production_attachments"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_attachments_pathname_key" ON "production_attachments"("pathname");

-- AddForeignKey
ALTER TABLE "production_attachments" ADD CONSTRAINT "production_attachments_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_attachments" ADD CONSTRAINT "production_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
