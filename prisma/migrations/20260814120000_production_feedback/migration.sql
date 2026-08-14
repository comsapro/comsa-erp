-- AlterEnum
ALTER TYPE "production_status" ADD VALUE IF NOT EXISTS 'REWORK';

-- CreateEnum
CREATE TYPE "production_process_source_type" AS ENUM ('QUOTATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "production_process_status" AS ENUM ('PENDING', 'COMPLETED', 'REPLACED');

-- CreateEnum
CREATE TYPE "purchase_order_item_source_type" AS ENUM ('QUOTE_MATERIAL', 'MANUAL');

-- AlterTable
ALTER TABLE "purchase_order_items"
ADD COLUMN "source_type" "purchase_order_item_source_type" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "source_material_id" TEXT;

-- CreateTable
CREATE TABLE "production_item_processes" (
    "id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "source_type" "production_process_source_type" NOT NULL,
    "quoted_manufacturing_id" TEXT,
    "manufacturing_process_id" TEXT,
    "process_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" "process_unit" NOT NULL,
    "quoted_hours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "expected_hours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "real_hours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "production_process_status" NOT NULL DEFAULT 'PENDING',
    "replaced_process_id" TEXT,
    "replacement_reason" TEXT,
    "replaced_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "production_item_processes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "production_item_processes_production_item_id_sort_order_idx"
  ON "production_item_processes"("production_item_id", "sort_order");

CREATE INDEX "production_item_processes_manufacturing_process_id_idx"
  ON "production_item_processes"("manufacturing_process_id");

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_manufacturing_process_id_fkey"
FOREIGN KEY ("manufacturing_process_id") REFERENCES "manufacturing_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_replaced_by_fkey"
FOREIGN KEY ("replaced_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_replaced_process_id_fkey"
FOREIGN KEY ("replaced_process_id") REFERENCES "production_item_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill inherited quotation processes
INSERT INTO "production_item_processes" (
  "id",
  "production_item_id",
  "source_type",
  "quoted_manufacturing_id",
  "manufacturing_process_id",
  "process_name_snapshot",
  "unit_snapshot",
  "quoted_hours",
  "expected_hours",
  "real_hours",
  "status",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  concat('bf_', m."id"),
  pi."id",
  'QUOTATION'::"production_process_source_type",
  m."id",
  m."manufacturing_process_id",
  m."process_name_snapshot",
  m."unit_snapshot",
  CASE WHEN m."unit_snapshot" = 'HOUR' THEN m."quantity" ELSE 0 END,
  CASE WHEN m."unit_snapshot" = 'HOUR' THEN m."quantity" ELSE 0 END,
  0,
  'PENDING'::"production_process_status",
  m."sort_order",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "production_items" pi
JOIN "quote_item_manufacturing" m ON m."quote_item_id" = pi."source_item_id"
WHERE pi."source_item_type" = 'QUOTE_ITEM'
  AND NOT EXISTS (
    SELECT 1 FROM "production_item_processes" p
    WHERE p."production_item_id" = pi."id"
      AND p."quoted_manufacturing_id" = m."id"
  );

-- Permissions
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
VALUES
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_1'), 'production', 'reopen_item', 'production.reopen_item', 'Reabrir item - Produccion'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_2'), 'production', 'manage_processes', 'production.manage_processes', 'Gestionar procesos - Produccion'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_3'), 'production', 'record_process_hours', 'production.record_process_hours', 'Registrar horas de proceso - Produccion')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" IN ('production.reopen_item', 'production.manage_processes', 'production.record_process_hours')
  AND (
    r."name" = 'Administrador'
    OR r."name" = 'Produccion'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."name" = 'Produccion'
  AND p."code" = 'quotes.view';
