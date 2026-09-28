-- Fase 2 Calidad: reemplaza prototipo de inspecciones/documentos previo
-- (tablas legacy con pocas filas de prueba)

DROP TABLE IF EXISTS "quality_annotations" CASCADE;
DROP TABLE IF EXISTS "quality_measurements" CASCADE;
DROP TABLE IF EXISTS "quality_inspections" CASCADE;
DROP TABLE IF EXISTS "quality_document_versions" CASCADE;
DROP TABLE IF EXISTS "quality_documents" CASCADE;

DROP TYPE IF EXISTS "quality_annotation_status";
DROP TYPE IF EXISTS "quality_annotation_type";
DROP TYPE IF EXISTS "quality_document_source_kind";
DROP TYPE IF EXISTS "quality_document_type";
DROP TYPE IF EXISTS "quality_measurement_result";
DROP TYPE IF EXISTS "quality_inspection_status";

ALTER TYPE "folio_scope" ADD VALUE IF NOT EXISTS 'QUALITY_REWORK';

CREATE TYPE "quality_inspection_mode" AS ENUM ('FULL', 'SAMPLE');
CREATE TYPE "quality_item_inspection_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'FIRST_PIECE_PENDING', 'WAITING_PRODUCTION', 'CLOSED');
CREATE TYPE "quality_piece_status" AS ENUM ('PENDING', 'IN_INSPECTION', 'CONFORMING', 'NON_CONFORMING', 'REWORK', 'RELEASED');
CREATE TYPE "quality_inspection_type" AS ENUM ('FIRST_PIECE', 'PIECE', 'SAMPLE', 'SPECIAL');
CREATE TYPE "quality_inspection_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');
CREATE TYPE "quality_result" AS ENUM ('PENDING', 'CONFORMING', 'NON_CONFORMING');
CREATE TYPE "quality_special_check_type" AS ENUM ('DIMENSIONAL', 'VISUAL', 'LIQUID_PENETRANT', 'HARDNESS', 'OTHER');
CREATE TYPE "quality_rework_status" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "instrument_status" AS ENUM ('ACTIVE', 'DUE_SOON', 'EXPIRED', 'OUT_OF_SERVICE');
CREATE TYPE "quality_alert_audience" AS ENUM ('PRODUCTION', 'SALES', 'MANAGEMENT', 'QUALITY');
CREATE TYPE "quality_alert_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "quality_evidence_stage" AS ENUM ('INSPECTION', 'DEFECT', 'BEFORE_REWORK', 'AFTER_REWORK', 'SPECIAL', 'OTHER');

CREATE TABLE "quality_item_configs" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "requires_first_piece" BOOLEAN NOT NULL DEFAULT false,
    "first_piece_released" BOOLEAN NOT NULL DEFAULT false,
    "first_piece_released_at" TIMESTAMP(3),
    "inspection_mode" "quality_inspection_mode" NOT NULL DEFAULT 'FULL',
    "sample_every_n" INTEGER,
    "sample_count_required" INTEGER,
    "requested_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "fabricated_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "inspected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "released_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "missing_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "inspection_status" "quality_item_inspection_status" NOT NULL DEFAULT 'PENDING',
    "sampling_configured_by" TEXT,
    "sampling_configured_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "quality_item_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_pieces" (
    "id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "quality_config_id" TEXT NOT NULL,
    "piece_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "quality_piece_status" NOT NULL DEFAULT 'PENDING',
    "is_first_piece" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "result" "quality_result" NOT NULL DEFAULT 'PENDING',
    "released_at" TIMESTAMP(3),
    "released_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "quality_pieces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "measuring_instruments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "range" TEXT,
    "resolution" TEXT,
    "unit" TEXT,
    "acquired_at" DATE,
    "last_calibration_at" DATE,
    "calibration_period_days" INTEGER,
    "next_calibration_at" DATE,
    "status" "instrument_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "measuring_instruments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_inspections" (
    "id" TEXT NOT NULL,
    "quality_config_id" TEXT NOT NULL,
    "quality_piece_id" TEXT,
    "type" "quality_inspection_type" NOT NULL,
    "status" "quality_inspection_status" NOT NULL DEFAULT 'DRAFT',
    "result" "quality_result" NOT NULL DEFAULT 'PENDING',
    "inspector_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "observations" TEXT,
    "instrument_id" TEXT,
    "instrument_warned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_measurements" (
    "id" TEXT NOT NULL,
    "quality_inspection_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nominal" TEXT,
    "tolerance_plus" TEXT,
    "tolerance_minus" TEXT,
    "measured_value" TEXT,
    "unit" TEXT,
    "result" "quality_result" NOT NULL DEFAULT 'PENDING',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quality_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_special_checks" (
    "id" TEXT NOT NULL,
    "quality_inspection_id" TEXT NOT NULL,
    "check_type" "quality_special_check_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT,
    "unit" TEXT,
    "expected_value" TEXT,
    "obtained_value" TEXT,
    "result" "quality_result" NOT NULL DEFAULT 'PENDING',
    "report_pathname" TEXT,
    "report_file_name" TEXT,
    "instrument_id" TEXT,
    "observations" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quality_special_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_rework_orders" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "status" "quality_rework_status" NOT NULL DEFAULT 'REQUESTED',
    "cause" TEXT NOT NULL,
    "instructions" TEXT,
    "area" TEXT,
    "process_name" TEXT,
    "operator_name" TEXT,
    "material_used" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "expected_end_at" DATE,
    "completed_at" TIMESTAMP(3),
    "total_hours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "final_result" "quality_result" NOT NULL DEFAULT 'PENDING',
    "responsible_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "quality_rework_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_rework_simples" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "quality_piece_id" TEXT,
    "area" TEXT,
    "process_name" TEXT,
    "operator_name" TEXT,
    "error_description" TEXT NOT NULL,
    "hours_used" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quality_rework_simples_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_non_conformances" (
    "id" TEXT NOT NULL,
    "quality_inspection_id" TEXT NOT NULL,
    "quality_piece_id" TEXT,
    "result" "quality_result" NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT,
    "process_name" TEXT,
    "operator_id" TEXT,
    "production_incident_id" TEXT,
    "rework_order_id" TEXT,
    "rework_simple_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "quality_non_conformances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_missing_process_requests" (
    "id" TEXT NOT NULL,
    "quality_inspection_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "manufacturing_process_id" TEXT,
    "notes" TEXT,
    "production_process_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "quality_missing_process_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_rework_order_pieces" (
    "id" TEXT NOT NULL,
    "rework_order_id" TEXT NOT NULL,
    "quality_piece_id" TEXT NOT NULL,
    CONSTRAINT "quality_rework_order_pieces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_rework_hours" (
    "id" TEXT NOT NULL,
    "rework_order_id" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "hours" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "quality_rework_hours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instrument_calibrations" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "calibrated_at" DATE NOT NULL,
    "next_due_at" DATE,
    "provider" TEXT,
    "certificate_pathname" TEXT,
    "certificate_file_name" TEXT,
    "certificate_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "instrument_calibrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_evidences" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT,
    "production_item_id" TEXT,
    "quality_piece_id" TEXT,
    "quality_inspection_id" TEXT,
    "special_check_id" TEXT,
    "non_conformance_id" TEXT,
    "rework_order_id" TEXT,
    "rework_simple_id" TEXT,
    "stage" "quality_evidence_stage" NOT NULL DEFAULT 'INSPECTION',
    "pathname" TEXT NOT NULL,
    "url" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "quality_evidences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_alerts" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT,
    "audience" "quality_alert_audience" NOT NULL,
    "status" "quality_alert_status" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "assignee_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quality_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_external_shares" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "quality_piece_id" TEXT,
    "production_order_id" TEXT,
    "production_item_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "show_evidences" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "quality_external_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quality_item_configs_production_item_id_key" ON "quality_item_configs"("production_item_id");
CREATE INDEX "quality_item_configs_production_order_id_idx" ON "quality_item_configs"("production_order_id");
CREATE INDEX "quality_item_configs_inspection_status_idx" ON "quality_item_configs"("inspection_status");
CREATE INDEX "quality_pieces_quality_config_id_idx" ON "quality_pieces"("quality_config_id");
CREATE INDEX "quality_pieces_status_idx" ON "quality_pieces"("status");
CREATE UNIQUE INDEX "quality_pieces_production_item_id_piece_number_key" ON "quality_pieces"("production_item_id", "piece_number");
CREATE INDEX "quality_inspections_quality_config_id_idx" ON "quality_inspections"("quality_config_id");
CREATE INDEX "quality_inspections_quality_piece_id_idx" ON "quality_inspections"("quality_piece_id");
CREATE INDEX "quality_inspections_inspector_id_idx" ON "quality_inspections"("inspector_id");
CREATE INDEX "quality_inspections_status_idx" ON "quality_inspections"("status");
CREATE INDEX "quality_measurements_quality_inspection_id_idx" ON "quality_measurements"("quality_inspection_id");
CREATE INDEX "quality_special_checks_quality_inspection_id_idx" ON "quality_special_checks"("quality_inspection_id");
CREATE INDEX "quality_non_conformances_quality_inspection_id_idx" ON "quality_non_conformances"("quality_inspection_id");
CREATE INDEX "quality_non_conformances_quality_piece_id_idx" ON "quality_non_conformances"("quality_piece_id");
CREATE INDEX "quality_missing_process_requests_quality_inspection_id_idx" ON "quality_missing_process_requests"("quality_inspection_id");
CREATE INDEX "quality_missing_process_requests_production_item_id_idx" ON "quality_missing_process_requests"("production_item_id");
CREATE UNIQUE INDEX "quality_rework_orders_folio_key" ON "quality_rework_orders"("folio");
CREATE INDEX "quality_rework_orders_production_order_id_idx" ON "quality_rework_orders"("production_order_id");
CREATE INDEX "quality_rework_orders_production_item_id_idx" ON "quality_rework_orders"("production_item_id");
CREATE INDEX "quality_rework_orders_status_idx" ON "quality_rework_orders"("status");
CREATE UNIQUE INDEX "quality_rework_order_pieces_rework_order_id_quality_piece_i_key" ON "quality_rework_order_pieces"("rework_order_id", "quality_piece_id");
CREATE INDEX "quality_rework_simples_production_order_id_idx" ON "quality_rework_simples"("production_order_id");
CREATE INDEX "quality_rework_simples_production_item_id_idx" ON "quality_rework_simples"("production_item_id");
CREATE INDEX "quality_rework_hours_rework_order_id_idx" ON "quality_rework_hours"("rework_order_id");
CREATE UNIQUE INDEX "measuring_instruments_code_key" ON "measuring_instruments"("code");
CREATE INDEX "measuring_instruments_status_idx" ON "measuring_instruments"("status");
CREATE INDEX "measuring_instruments_deleted_at_idx" ON "measuring_instruments"("deleted_at");
CREATE INDEX "instrument_calibrations_instrument_id_calibrated_at_idx" ON "instrument_calibrations"("instrument_id", "calibrated_at");
CREATE INDEX "quality_evidences_production_order_id_idx" ON "quality_evidences"("production_order_id");
CREATE INDEX "quality_evidences_quality_inspection_id_idx" ON "quality_evidences"("quality_inspection_id");
CREATE UNIQUE INDEX "quality_evidences_pathname_key" ON "quality_evidences"("pathname");
CREATE INDEX "quality_alerts_audience_status_idx" ON "quality_alerts"("audience", "status");
CREATE INDEX "quality_alerts_production_order_id_idx" ON "quality_alerts"("production_order_id");
CREATE UNIQUE INDEX "quality_external_shares_token_key" ON "quality_external_shares"("token");
CREATE INDEX "quality_external_shares_token_idx" ON "quality_external_shares"("token");

ALTER TABLE "quality_item_configs" ADD CONSTRAINT "quality_item_configs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_item_configs" ADD CONSTRAINT "quality_item_configs_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_pieces" ADD CONSTRAINT "quality_pieces_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_pieces" ADD CONSTRAINT "quality_pieces_quality_config_id_fkey" FOREIGN KEY ("quality_config_id") REFERENCES "quality_item_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "measuring_instruments" ADD CONSTRAINT "measuring_instruments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_quality_config_id_fkey" FOREIGN KEY ("quality_config_id") REFERENCES "quality_item_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "measuring_instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_measurements" ADD CONSTRAINT "quality_measurements_quality_inspection_id_fkey" FOREIGN KEY ("quality_inspection_id") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_special_checks" ADD CONSTRAINT "quality_special_checks_quality_inspection_id_fkey" FOREIGN KEY ("quality_inspection_id") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_special_checks" ADD CONSTRAINT "quality_special_checks_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "measuring_instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_rework_orders" ADD CONSTRAINT "quality_rework_orders_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_orders" ADD CONSTRAINT "quality_rework_orders_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_orders" ADD CONSTRAINT "quality_rework_orders_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_rework_orders" ADD CONSTRAINT "quality_rework_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_rework_simples" ADD CONSTRAINT "quality_rework_simples_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_simples" ADD CONSTRAINT "quality_rework_simples_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_simples" ADD CONSTRAINT "quality_rework_simples_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_rework_simples" ADD CONSTRAINT "quality_rework_simples_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_non_conformances" ADD CONSTRAINT "quality_non_conformances_quality_inspection_id_fkey" FOREIGN KEY ("quality_inspection_id") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_non_conformances" ADD CONSTRAINT "quality_non_conformances_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_non_conformances" ADD CONSTRAINT "quality_non_conformances_rework_order_id_fkey" FOREIGN KEY ("rework_order_id") REFERENCES "quality_rework_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_non_conformances" ADD CONSTRAINT "quality_non_conformances_rework_simple_id_fkey" FOREIGN KEY ("rework_simple_id") REFERENCES "quality_rework_simples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_missing_process_requests" ADD CONSTRAINT "quality_missing_process_requests_quality_inspection_id_fkey" FOREIGN KEY ("quality_inspection_id") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_order_pieces" ADD CONSTRAINT "quality_rework_order_pieces_rework_order_id_fkey" FOREIGN KEY ("rework_order_id") REFERENCES "quality_rework_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_order_pieces" ADD CONSTRAINT "quality_rework_order_pieces_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_rework_hours" ADD CONSTRAINT "quality_rework_hours_rework_order_id_fkey" FOREIGN KEY ("rework_order_id") REFERENCES "quality_rework_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instrument_calibrations" ADD CONSTRAINT "instrument_calibrations_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "measuring_instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_quality_inspection_id_fkey" FOREIGN KEY ("quality_inspection_id") REFERENCES "quality_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_special_check_id_fkey" FOREIGN KEY ("special_check_id") REFERENCES "quality_special_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_non_conformance_id_fkey" FOREIGN KEY ("non_conformance_id") REFERENCES "quality_non_conformances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_rework_order_id_fkey" FOREIGN KEY ("rework_order_id") REFERENCES "quality_rework_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_evidences" ADD CONSTRAINT "quality_evidences_rework_simple_id_fkey" FOREIGN KEY ("rework_simple_id") REFERENCES "quality_rework_simples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_alerts" ADD CONSTRAINT "quality_alerts_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_alerts" ADD CONSTRAINT "quality_alerts_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_external_shares" ADD CONSTRAINT "quality_external_shares_quality_piece_id_fkey" FOREIGN KEY ("quality_piece_id") REFERENCES "quality_pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_external_shares" ADD CONSTRAINT "quality_external_shares_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
