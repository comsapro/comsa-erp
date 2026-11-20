-- Dashboard gerencial y KPIs: estatus operativo de trabajos, incidencias de
-- junta con seguimiento, notificaciones internas, catalogos administrables,
-- datos de cobranza en facturas, costo de errores de calidad y correcciones
-- auditadas.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_priority') THEN
    CREATE TYPE "incident_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_tracking_status') THEN
    CREATE TYPE "production_tracking_status" AS ENUM (
      'PENDING', 'IN_PRODUCTION', 'IN_QUALITY', 'FINISHED', 'RELEASED', 'DELAYED', 'STOPPED', 'DELIVERED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_error_detection') THEN
    CREATE TYPE "quality_error_detection" AS ENUM ('PRODUCTION', 'QUALITY', 'CLIENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_error_cost_category') THEN
    CREATE TYPE "quality_error_cost_category" AS ENUM ('LABOR', 'MATERIAL', 'OTHER');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Columnas nuevas
-- -----------------------------------------------------------------------------
ALTER TABLE "production_items"
  ADD COLUMN IF NOT EXISTS "tracking_status" "production_tracking_status",
  ADD COLUMN IF NOT EXISTS "tracking_status_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tracking_status_by" TEXT,
  ADD COLUMN IF NOT EXISTS "delivered_at" DATE;

ALTER TABLE "production_incidents"
  ADD COLUMN IF NOT EXISTS "priority" "incident_priority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "reason_code" TEXT,
  ADD COLUMN IF NOT EXISTS "related_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS "attended_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attended_by" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "closed_by" TEXT;

CREATE INDEX IF NOT EXISTS "production_incidents_assigned_to_user_id_status_idx"
  ON "production_incidents"("assigned_to_user_id", "status");

ALTER TABLE "sales_goals"
  ADD COLUMN IF NOT EXISTS "amount_includes_tax" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "client_id" TEXT,
  ADD COLUMN IF NOT EXISTS "sent_at" DATE,
  ADD COLUMN IF NOT EXISTS "credit_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "due_date" DATE,
  ADD COLUMN IF NOT EXISTS "paid_at" DATE,
  ADD COLUMN IF NOT EXISTS "payment_notes" TEXT;

CREATE INDEX IF NOT EXISTS "sales_invoices_client_id_idx" ON "sales_invoices"("client_id");
CREATE INDEX IF NOT EXISTS "sales_invoices_due_date_idx" ON "sales_invoices"("due_date");
CREATE INDEX IF NOT EXISTS "sales_invoices_paid_at_idx" ON "sales_invoices"("paid_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_invoices_client_id_fkey') THEN
    ALTER TABLE "sales_invoices"
      ADD CONSTRAINT "sales_invoices_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tablas nuevas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "production_incident_comments" (
  "id" TEXT NOT NULL,
  "incident_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'COMMENT',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_incident_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "production_incident_comments_incident_id_created_at_idx"
  ON "production_incident_comments"("incident_id", "created_at");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "priority" "incident_priority" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "kpi_catalog_entries" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "related_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suggested_responsible" TEXT NOT NULL DEFAULT 'NONE',
  "required_action" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_by" TEXT,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "kpi_catalog_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_catalog_entries_type_code_key" ON "kpi_catalog_entries"("type", "code");
CREATE INDEX IF NOT EXISTS "kpi_catalog_entries_type_status_idx" ON "kpi_catalog_entries"("type", "status");

CREATE TABLE IF NOT EXISTS "kpi_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "tax_rate" DECIMAL(6,2) NOT NULL DEFAULT 16,
  "labor_hour_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "default_credit_days" INTEGER NOT NULL DEFAULT 30,
  "upcoming_days" INTEGER NOT NULL DEFAULT 7,
  "due_soon_days" INTEGER NOT NULL DEFAULT 7,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "kpi_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "kpi_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "quality_errors" (
  "id" TEXT NOT NULL,
  "production_order_id" TEXT NOT NULL,
  "production_item_id" TEXT,
  "quote_id" TEXT,
  "detected_at" DATE NOT NULL,
  "detection_stage" "quality_error_detection" NOT NULL DEFAULT 'QUALITY',
  "cause_code" TEXT,
  "area_code" TEXT,
  "area_text" TEXT,
  "operator_user_id" TEXT,
  "operator_name" TEXT,
  "description" TEXT NOT NULL,
  "rework_order_id" TEXT,
  "rework_simple_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_by" TEXT,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "quality_errors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quality_errors_rework_order_id_key" ON "quality_errors"("rework_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quality_errors_rework_simple_id_key" ON "quality_errors"("rework_simple_id");
CREATE INDEX IF NOT EXISTS "quality_errors_detected_at_idx" ON "quality_errors"("detected_at");
CREATE INDEX IF NOT EXISTS "quality_errors_production_order_id_idx" ON "quality_errors"("production_order_id");
CREATE INDEX IF NOT EXISTS "quality_errors_production_item_id_idx" ON "quality_errors"("production_item_id");
CREATE INDEX IF NOT EXISTS "quality_errors_deleted_at_idx" ON "quality_errors"("deleted_at");

CREATE TABLE IF NOT EXISTS "quality_error_costs" (
  "id" TEXT NOT NULL,
  "error_id" TEXT NOT NULL,
  "category" "quality_error_cost_category" NOT NULL,
  "concept" TEXT NOT NULL,
  "hours" DECIMAL(14,3),
  "hourly_rate" DECIMAL(14,2),
  "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "quality_error_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quality_error_costs_error_id_idx" ON "quality_error_costs"("error_id");

CREATE TABLE IF NOT EXISTS "data_corrections" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "original_value" TEXT,
  "new_value" TEXT,
  "reason" TEXT NOT NULL,
  "corrected_by" TEXT,
  "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "data_corrections_entity_type_entity_id_idx" ON "data_corrections"("entity_type", "entity_id");

-- -----------------------------------------------------------------------------
-- Llaves foraneas
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_incident_comments_incident_id_fkey') THEN
    ALTER TABLE "production_incident_comments" ADD CONSTRAINT "production_incident_comments_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "production_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_incident_comments_created_by_fkey') THEN
    ALTER TABLE "production_incident_comments" ADD CONSTRAINT "production_incident_comments_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_production_order_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_production_order_id_fkey"
      FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_production_item_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_production_item_id_fkey"
      FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_quote_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_quote_id_fkey"
      FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_operator_user_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_operator_user_id_fkey"
      FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_created_by_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_rework_order_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_rework_order_id_fkey"
      FOREIGN KEY ("rework_order_id") REFERENCES "quality_rework_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_errors_rework_simple_id_fkey') THEN
    ALTER TABLE "quality_errors" ADD CONSTRAINT "quality_errors_rework_simple_id_fkey"
      FOREIGN KEY ("rework_simple_id") REFERENCES "quality_rework_simples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_error_costs_error_id_fkey') THEN
    ALTER TABLE "quality_error_costs" ADD CONSTRAINT "quality_error_costs_error_id_fkey"
      FOREIGN KEY ("error_id") REFERENCES "quality_errors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_corrections_corrected_by_fkey') THEN
    ALTER TABLE "data_corrections" ADD CONSTRAINT "data_corrections_corrected_by_fkey"
      FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfill de facturas: cliente desde la cotizacion ligada, dias de credito
-- desde condiciones comerciales del cliente (numericas) y fecha limite.
-- -----------------------------------------------------------------------------
UPDATE "sales_invoices" si
SET "client_id" = sub."client_id"
FROM (
  SELECT DISTINCT ON (siq."sales_invoice_id") siq."sales_invoice_id", q."client_id"
  FROM "sales_invoice_quotes" siq
  JOIN "quotes" q ON q."id" = siq."quote_id"
  ORDER BY siq."sales_invoice_id", siq."id"
) sub
WHERE si."id" = sub."sales_invoice_id" AND si."client_id" IS NULL;

UPDATE "sales_invoices" si
SET "credit_days" = COALESCE(
  CASE WHEN c."commercial_terms" ~ '^\s*[0-9]{1,4}\s*$' THEN trim(c."commercial_terms")::INTEGER END,
  30
)
FROM "clients" c
WHERE si."client_id" = c."id" AND si."credit_days" IS NULL;

UPDATE "sales_invoices"
SET "credit_days" = 30
WHERE "credit_days" IS NULL;

UPDATE "sales_invoices"
SET "due_date" = "reception_date" + "credit_days"
WHERE "due_date" IS NULL AND "reception_date" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Catalogos iniciales (editables por un administrador)
-- -----------------------------------------------------------------------------
INSERT INTO "kpi_catalog_entries"
  ("id", "type", "code", "label", "related_modules", "suggested_responsible", "required_action", "sort_order")
VALUES
  ('kpicat_stop_material', 'STOP_REASON', 'MATERIAL', 'Falta de material', ARRAY['PRODUCTION','SALES','PURCHASING'], 'SELLER', 'Dar seguimiento a la compra del material para poder continuar con el proyecto.', 10),
  ('kpicat_stop_process', 'STOP_REASON', 'PROCESS', 'Falta de proceso', ARRAY['PRODUCTION','QUALITY'], 'NONE', 'Definir o agregar el proceso faltante para continuar.', 20),
  ('kpicat_stop_client_info', 'STOP_REASON', 'CLIENT_INFO', 'Falta de información del cliente', ARRAY['PRODUCTION','SALES'], 'SELLER', 'Solicitar al cliente la información faltante.', 30),
  ('kpicat_stop_approval', 'STOP_REASON', 'APPROVAL', 'Esperando aprobación', ARRAY['PRODUCTION','SALES'], 'SELLER', 'Obtener la aprobación pendiente.', 40),
  ('kpicat_stop_production', 'STOP_REASON', 'PRODUCTION_ISSUE', 'Problema de producción', ARRAY['PRODUCTION'], 'ITEM_ASSIGNEE', 'Resolver el problema de producción.', 50),
  ('kpicat_stop_quality', 'STOP_REASON', 'QUALITY_ISSUE', 'Problema de Calidad', ARRAY['PRODUCTION','QUALITY'], 'NONE', 'Calidad debe definir la disposición de la pieza.', 60),
  ('kpicat_stop_supplier', 'STOP_REASON', 'SUPPLIER_ISSUE', 'Problema de proveedor', ARRAY['PURCHASING','PRODUCTION'], 'NONE', 'Dar seguimiento con el proveedor.', 70),
  ('kpicat_stop_other', 'STOP_REASON', 'OTHER', 'Otro', ARRAY[]::TEXT[], 'NONE', NULL, 99),

  ('kpicat_cause_operator', 'ERROR_CAUSE', 'OPERATOR', 'Error de operador', ARRAY[]::TEXT[], 'NONE', NULL, 10),
  ('kpicat_cause_sales', 'ERROR_CAUSE', 'SALES_INSTRUCTION', 'Error de instrucción de Ventas', ARRAY[]::TEXT[], 'NONE', NULL, 20),
  ('kpicat_cause_client', 'ERROR_CAUSE', 'CLIENT_INSTRUCTION', 'Error de instrucción del cliente', ARRAY[]::TEXT[], 'NONE', NULL, 30),
  ('kpicat_cause_material', 'ERROR_CAUSE', 'MATERIAL', 'Falta de material', ARRAY[]::TEXT[], 'NONE', NULL, 40),
  ('kpicat_cause_machine', 'ERROR_CAUSE', 'MACHINE', 'Falla de máquina', ARRAY[]::TEXT[], 'NONE', NULL, 50),
  ('kpicat_cause_programming', 'ERROR_CAUSE', 'PROGRAMMING', 'Error de programación', ARRAY[]::TEXT[], 'NONE', NULL, 60),
  ('kpicat_cause_process', 'ERROR_CAUSE', 'PROCESS', 'Error de proceso', ARRAY[]::TEXT[], 'NONE', NULL, 70),
  ('kpicat_cause_measurement', 'ERROR_CAUSE', 'MEASUREMENT', 'Error de medición', ARRAY[]::TEXT[], 'NONE', NULL, 80),
  ('kpicat_cause_other', 'ERROR_CAUSE', 'OTHER', 'Otro', ARRAY[]::TEXT[], 'NONE', NULL, 99),

  ('kpicat_area_cnc', 'ERROR_AREA', 'CNC', 'CNC', ARRAY[]::TEXT[], 'NONE', NULL, 10),
  ('kpicat_area_torno', 'ERROR_AREA', 'TORNO', 'Torno', ARRAY[]::TEXT[], 'NONE', NULL, 20),
  ('kpicat_area_fresadora', 'ERROR_AREA', 'FRESADORA', 'Fresadora', ARRAY[]::TEXT[], 'NONE', NULL, 30),
  ('kpicat_area_soldadura', 'ERROR_AREA', 'SOLDADURA', 'Soldadura', ARRAY[]::TEXT[], 'NONE', NULL, 40),
  ('kpicat_area_calidad', 'ERROR_AREA', 'CALIDAD', 'Calidad', ARRAY[]::TEXT[], 'NONE', NULL, 50),
  ('kpicat_area_ventas', 'ERROR_AREA', 'VENTAS', 'Ventas', ARRAY[]::TEXT[], 'NONE', NULL, 60),
  ('kpicat_area_compras', 'ERROR_AREA', 'COMPRAS', 'Compras', ARRAY[]::TEXT[], 'NONE', NULL, 70),
  ('kpicat_area_cliente', 'ERROR_AREA', 'CLIENTE', 'Cliente', ARRAY[]::TEXT[], 'NONE', NULL, 80),
  ('kpicat_area_otro', 'ERROR_AREA', 'OTRO', 'Otro', ARRAY[]::TEXT[], 'NONE', NULL, 99)
ON CONFLICT ("type", "code") DO NOTHING;

-- -----------------------------------------------------------------------------
-- Permisos y asignacion a roles del sistema
-- -----------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
VALUES
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpiview'), 'kpis', 'view', 'kpis.view', 'Visualizar - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpiinc'), 'kpis', 'manage_incidents', 'kpis.manage_incidents', 'Administrar incidencias - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpista'), 'kpis', 'update_status', 'kpis.update_status', 'Cambiar estatus de trabajos - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpicat'), 'kpis', 'manage_catalogs', 'kpis.manage_catalogs', 'Administrar catalogos - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpicor'), 'kpis', 'correct_data', 'kpis.correct_data', 'Corregir datos con auditoria - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_kpiexp'), 'kpis', 'export', 'kpis.export', 'Exportar - Dashboard gerencial'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_qerr'), 'quality', 'record_errors', 'quality.record_errors', 'Registrar errores y costos - Calidad')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE (
    r."name" IN ('Administrador', 'Direccion')
    AND p."code" IN ('kpis.view', 'kpis.manage_incidents', 'kpis.update_status', 'kpis.manage_catalogs', 'kpis.correct_data', 'kpis.export')
  ) OR (
    r."name" = 'Supervisor'
    AND p."code" IN ('kpis.view', 'kpis.manage_incidents', 'kpis.update_status', 'kpis.export')
  ) OR (
    r."name" = 'Administracion'
    AND p."code" IN ('kpis.view', 'kpis.export')
  ) OR (
    r."name" IN ('Administrador', 'Calidad')
    AND p."code" = 'quality.record_errors'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
