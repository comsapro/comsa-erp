-- Planos de calidad: documentos, revisiones y anotaciones
-- (tablas propias; no reutiliza quality_inspections de Fase 2)

ALTER TYPE "folio_scope" ADD VALUE IF NOT EXISTS 'QUALITY_INSPECTION';

CREATE TYPE "quality_document_type" AS ENUM ('DRAWING', 'SPECIFICATION', 'QUALITY_PLAN', 'OTHER');
CREATE TYPE "quality_document_source_kind" AS ENUM ('QUOTE_ATTACHMENT', 'PRODUCTION_ATTACHMENT', 'QUALITY_UPLOAD');
CREATE TYPE "quality_drawing_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');
CREATE TYPE "quality_annotation_type" AS ENUM ('MEASUREMENT', 'COMMENT', 'OBSERVATION');
CREATE TYPE "quality_annotation_status" AS ENUM ('OPEN', 'PASS', 'FAIL', 'NOT_APPLICABLE');
CREATE TYPE "quality_drawing_measurement_result" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "quality_documents" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "source_kind" "quality_document_source_kind" NOT NULL,
    "quote_item_attachment_id" TEXT,
    "production_attachment_id" TEXT,
    "document_type" "quality_document_type" NOT NULL DEFAULT 'DRAWING',
    "current_version_number" INTEGER NOT NULL DEFAULT 1,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "original_filename" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "quality_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_document_versions" (
    "id" TEXT NOT NULL,
    "quality_document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "pathname" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "page_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "quality_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_drawing_inspections" (
    "id" TEXT NOT NULL,
    "inspection_number" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "quality_document_version_id" TEXT NOT NULL,
    "status" "quality_drawing_status" NOT NULL DEFAULT 'DRAFT',
    "inspected_by" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "general_comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "quality_drawing_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_annotations" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "quality_document_version_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "x_position" DECIMAL(10,8) NOT NULL,
    "y_position" DECIMAL(10,8) NOT NULL,
    "annotation_type" "quality_annotation_type" NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "quality_annotation_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "quality_annotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quality_drawing_measurements" (
    "id" TEXT NOT NULL,
    "annotation_id" TEXT NOT NULL,
    "nominal_value" DECIMAL(14,4) NOT NULL,
    "measured_value" DECIMAL(14,4) NOT NULL,
    "upper_tolerance" DECIMAL(14,4) NOT NULL,
    "lower_tolerance" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "result" "quality_drawing_measurement_result" NOT NULL,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quality_drawing_measurements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quality_drawing_inspections_inspection_number_key" ON "quality_drawing_inspections"("inspection_number");
CREATE INDEX "quality_drawing_inspections_production_item_id_status_idx" ON "quality_drawing_inspections"("production_item_id", "status");
CREATE INDEX "quality_drawing_inspections_production_order_id_idx" ON "quality_drawing_inspections"("production_order_id");
CREATE INDEX "quality_drawing_inspections_quality_document_version_id_idx" ON "quality_drawing_inspections"("quality_document_version_id");
CREATE UNIQUE INDEX "quality_document_versions_quality_document_id_version_number_key" ON "quality_document_versions"("quality_document_id", "version_number");
CREATE INDEX "quality_document_versions_pathname_idx" ON "quality_document_versions"("pathname");
CREATE INDEX "quality_documents_production_item_id_idx" ON "quality_documents"("production_item_id");
CREATE INDEX "quality_documents_production_order_id_idx" ON "quality_documents"("production_order_id");
CREATE INDEX "quality_documents_quote_item_attachment_id_idx" ON "quality_documents"("quote_item_attachment_id");
CREATE INDEX "quality_documents_production_attachment_id_idx" ON "quality_documents"("production_attachment_id");
CREATE INDEX "quality_documents_deleted_at_idx" ON "quality_documents"("deleted_at");
CREATE INDEX "quality_annotations_inspection_id_page_number_idx" ON "quality_annotations"("inspection_id", "page_number");
CREATE INDEX "quality_annotations_quality_document_version_id_idx" ON "quality_annotations"("quality_document_version_id");
CREATE INDEX "quality_annotations_deleted_at_idx" ON "quality_annotations"("deleted_at");
CREATE UNIQUE INDEX "quality_drawing_measurements_annotation_id_key" ON "quality_drawing_measurements"("annotation_id");
CREATE INDEX "quality_drawing_measurements_annotation_id_idx" ON "quality_drawing_measurements"("annotation_id");

ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_quote_item_attachment_id_fkey" FOREIGN KEY ("quote_item_attachment_id") REFERENCES "quote_item_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_production_attachment_id_fkey" FOREIGN KEY ("production_attachment_id") REFERENCES "production_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_documents" ADD CONSTRAINT "quality_documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_document_versions" ADD CONSTRAINT "quality_document_versions_quality_document_id_fkey" FOREIGN KEY ("quality_document_id") REFERENCES "quality_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_document_versions" ADD CONSTRAINT "quality_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_production_item_id_fkey" FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_quality_document_version_id_fkey" FOREIGN KEY ("quality_document_version_id") REFERENCES "quality_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_inspections" ADD CONSTRAINT "quality_drawing_inspections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_annotations" ADD CONSTRAINT "quality_annotations_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "quality_drawing_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_annotations" ADD CONSTRAINT "quality_annotations_quality_document_version_id_fkey" FOREIGN KEY ("quality_document_version_id") REFERENCES "quality_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_annotations" ADD CONSTRAINT "quality_annotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_annotations" ADD CONSTRAINT "quality_annotations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_drawing_measurements" ADD CONSTRAINT "quality_drawing_measurements_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "quality_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
