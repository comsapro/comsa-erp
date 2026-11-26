-- Compromisos manuales, equipo/descripcion en facturas, resguardo y condicion de
-- instrumentos, y catalogos nuevos (operadores, condicion de instrumento, motivo
-- de factura sin cotizacion).
-- CreateEnum
CREATE TYPE "commitment_status" AS ENUM ('OPEN', 'IN_REVIEW', 'CLOSED', 'CANCELLED');
-- AlterTable
-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "description" TEXT,
ADD COLUMN     "no_quote_reason_code" TEXT,
ADD COLUMN     "team_id" TEXT;
-- AlterTable
ALTER TABLE "measuring_instruments" ADD COLUMN     "assigned_at" DATE,
ADD COLUMN     "assigned_operator_code" TEXT,
ADD COLUMN     "assigned_user_id" TEXT,
ADD COLUMN     "condition_code" TEXT;
-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "commitment_status" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "commitment_participants" (
    "id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commitment_participants_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "commitment_comments" (
    "id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMMENT',
    "body" TEXT,
    "file_pathname" TEXT,
    "file_name" TEXT,
    "file_content_type" TEXT,
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commitment_comments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "commitments_status_due_date_idx" ON "commitments"("status", "due_date");
-- CreateIndex
CREATE INDEX "commitments_created_by_idx" ON "commitments"("created_by");
-- CreateIndex
CREATE INDEX "commitments_deleted_at_idx" ON "commitments"("deleted_at");
-- CreateIndex
CREATE INDEX "commitment_participants_user_id_idx" ON "commitment_participants"("user_id");
-- CreateIndex
CREATE UNIQUE INDEX "commitment_participants_commitment_id_user_id_key" ON "commitment_participants"("commitment_id", "user_id");
-- CreateIndex
CREATE INDEX "commitment_comments_commitment_id_created_at_idx" ON "commitment_comments"("commitment_id", "created_at");
-- CreateIndex
CREATE INDEX "sales_invoices_team_id_idx" ON "sales_invoices"("team_id");
-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "measuring_instruments" ADD CONSTRAINT "measuring_instruments_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitment_participants" ADD CONSTRAINT "commitment_participants_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitment_participants" ADD CONSTRAINT "commitment_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitment_comments" ADD CONSTRAINT "commitment_comments_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "commitment_comments" ADD CONSTRAINT "commitment_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Catalogos
-- -----------------------------------------------------------------------------
-- Areas de error vigentes; las anteriores que no estan en la lista quedan
-- inactivas (los historicos conservan su codigo).
INSERT INTO "kpi_catalog_entries" ("id", "type", "code", "label", "sort_order", "updated_at")
VALUES
  ('kpicat_area_fresadora', 'ERROR_AREA', 'FRESADORA', 'Fresadora', 10, now()),
  ('kpicat_area_waterjet', 'ERROR_AREA', 'WATERJET', 'Waterjet', 20, now()),
  ('kpicat_area_cliente', 'ERROR_AREA', 'CLIENTE', 'Cliente', 30, now()),
  ('kpicat_area_soldadura', 'ERROR_AREA', 'SOLDADURA', 'Soldadura', 40, now()),
  ('kpicat_area_cnc', 'ERROR_AREA', 'CNC', 'CNC', 50, now()),
  ('kpicat_area_laser', 'ERROR_AREA', 'LASER', 'Láser', 60, now()),
  ('kpicat_area_ventas', 'ERROR_AREA', 'VENTAS', 'Ventas', 70, now()),
  ('kpicat_area_torno_conv', 'ERROR_AREA', 'TORNO_CONVENCIONAL', 'Torno convencional', 80, now()),
  ('kpicat_area_torno_cnc', 'ERROR_AREA', 'TORNO_CNC', 'Torno CNC', 90, now()),
  ('kpicat_area_sierra_cinta', 'ERROR_AREA', 'SIERRA_CINTA', 'Sierra cinta', 100, now())
ON CONFLICT ("type", "code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order",
      "status" = 'active', "deleted_at" = NULL, "updated_at" = now();

UPDATE "kpi_catalog_entries"
SET "status" = 'inactive', "updated_at" = now()
WHERE "type" = 'ERROR_AREA'
  AND "code" NOT IN ('FRESADORA', 'WATERJET', 'CLIENTE', 'SOLDADURA', 'CNC', 'LASER', 'VENTAS', 'TORNO_CONVENCIONAL', 'TORNO_CNC', 'SIERRA_CINTA');

INSERT INTO "kpi_catalog_entries" ("id", "type", "code", "label", "sort_order", "updated_at")
VALUES
  ('kpicat_inst_activo', 'INSTRUMENT_STATUS', 'EN_USO', 'En uso', 10, now()),
  ('kpicat_inst_reparacion', 'INSTRUMENT_STATUS', 'EN_REPARACION', 'En reparación', 20, now()),
  ('kpicat_inst_calibracion', 'INSTRUMENT_STATUS', 'EN_CALIBRACION_EXTERNA', 'En calibración externa', 30, now()),
  ('kpicat_inst_resguardo', 'INSTRUMENT_STATUS', 'EN_RESGUARDO', 'En resguardo (almacén)', 40, now()),
  ('kpicat_inst_extraviado', 'INSTRUMENT_STATUS', 'EXTRAVIADO', 'Extraviado', 50, now()),
  ('kpicat_inst_baja', 'INSTRUMENT_STATUS', 'DADO_DE_BAJA', 'Dado de baja', 60, now()),
  ('kpicat_noquote_material', 'INVOICE_NO_QUOTE_REASON', 'VENTA_MATERIAL', 'Venta de material / reventa', 10, now()),
  ('kpicat_noquote_servicio', 'INVOICE_NO_QUOTE_REASON', 'SERVICIO_SIN_COTIZACION', 'Servicio sin cotización formal', 20, now()),
  ('kpicat_noquote_anticipo', 'INVOICE_NO_QUOTE_REASON', 'ANTICIPO', 'Anticipo', 30, now()),
  ('kpicat_noquote_refactura', 'INVOICE_NO_QUOTE_REASON', 'REFACTURACION', 'Refacturación / sustitución', 40, now()),
  ('kpicat_noquote_legacy', 'INVOICE_NO_QUOTE_REASON', 'COTIZACION_SISTEMA_ANTERIOR', 'Cotización del sistema anterior', 50, now()),
  ('kpicat_noquote_otro', 'INVOICE_NO_QUOTE_REASON', 'OTRO', 'Otro', 99, now())
ON CONFLICT ("type", "code") DO NOTHING;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
VALUES
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_cmtview'), 'commitments', 'view', 'commitments.view', 'Ver mis compromisos'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_cmtcre'), 'commitments', 'create', 'commitments.create', 'Crear compromisos'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_cmtall'), 'commitments', 'view_all', 'commitments.view_all', 'Ver todos los compromisos'),
  (concat('perm_', md5(random()::text || clock_timestamp()::text), '_qop'), 'quality', 'manage_operators', 'quality.manage_operators', 'Administrar catalogo de operadores - Calidad')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE (
    p."code" = 'commitments.view'
  ) OR (
    r."name" IN ('Administrador', 'Direccion')
    AND p."code" IN ('commitments.create', 'commitments.view_all', 'quality.manage_operators')
  ) OR (
    r."name" = 'Supervisor'
    AND p."code" = 'commitments.create'
  ) OR (
    r."name" = 'Calidad'
    AND p."code" = 'quality.manage_operators'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
