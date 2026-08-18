-- Enums
CREATE TYPE "production_item_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "production_activity_type" AS ENUM (
  'NOTE', 'STATUS', 'HOURS_MANUAL', 'SESSION_START', 'SESSION_PAUSE',
  'SESSION_RESUME', 'SESSION_END', 'PROCESS_CHANGE', 'INCIDENT', 'MATERIAL',
  'PHOTO', 'REOPEN', 'CLOSE', 'PLANNING'
);
CREATE TYPE "production_incident_status" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
CREATE TYPE "production_incident_type" AS ENUM (
  'ORDER', 'ITEM', 'PROCESS', 'MATERIAL', 'MACHINERY', 'DOCUMENTATION', 'OTHER'
);
CREATE TYPE "production_time_session_status" AS ENUM ('RUNNING', 'PAUSED', 'CLOSED');

-- Settings
CREATE TABLE "production_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "handicap_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "production_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "production_settings" ("id", "handicap_percent", "updated_at")
VALUES ('default', 0, CURRENT_TIMESTAMP);

-- Item planning / assignment
ALTER TABLE "production_items"
ADD COLUMN "priority" "production_item_priority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "assigned_to_user_id" TEXT,
ADD COLUMN "planned_start_at" DATE,
ADD COLUMN "planned_end_at" DATE,
ADD COLUMN "commitment_date" DATE,
ADD COLUMN "created_by" TEXT,
ADD COLUMN "updated_by" TEXT;

-- Process assignment / timestamps
ALTER TABLE "production_item_processes"
ADD COLUMN "handicap_snapshot" DECIMAL(6,2),
ADD COLUMN "assigned_to_user_id" TEXT,
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3);

-- Attachment links
ALTER TABLE "production_attachments"
ADD COLUMN "production_item_id" TEXT,
ADD COLUMN "process_id" TEXT,
ADD COLUMN "incident_id" TEXT,
ADD COLUMN "activity_id" TEXT;

CREATE TABLE "production_activities" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT,
    "process_id" TEXT,
    "incident_id" TEXT,
    "extra_material_id" TEXT,
    "type" "production_activity_type" NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_time_sessions" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "production_time_session_status" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL,
    "last_resumed_at" TIMESTAMP(3) NOT NULL,
    "paused_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "accumulated_minutes" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "duration_minutes" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_time_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_incidents" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT,
    "process_id" TEXT,
    "extra_material_id" TEXT,
    "type" "production_incident_type" NOT NULL DEFAULT 'OTHER',
    "status" "production_incident_status" NOT NULL DEFAULT 'OPEN',
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_taken" TEXT,
    "assigned_to_user_id" TEXT,
    "reported_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "production_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_extra_materials" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "production_item_id" TEXT,
    "process_id" TEXT,
    "catalog_item_id" TEXT,
    "supplier_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "unit_cost" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "production_extra_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_schedule_changes" (
    "id" TEXT NOT NULL,
    "production_item_id" TEXT NOT NULL,
    "previous_planned_start_at" DATE,
    "previous_planned_end_at" DATE,
    "previous_commitment_date" DATE,
    "new_planned_start_at" DATE,
    "new_planned_end_at" DATE,
    "new_commitment_date" DATE,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_schedule_changes_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "production_items_assigned_to_user_id_idx" ON "production_items"("assigned_to_user_id");
CREATE INDEX "production_items_priority_status_idx" ON "production_items"("priority", "status");
CREATE INDEX "production_items_commitment_date_idx" ON "production_items"("commitment_date");
CREATE INDEX "production_item_processes_assigned_to_user_id_idx" ON "production_item_processes"("assigned_to_user_id");
CREATE INDEX "production_attachments_production_item_id_idx" ON "production_attachments"("production_item_id");
CREATE INDEX "production_attachments_process_id_idx" ON "production_attachments"("process_id");
CREATE INDEX "production_attachments_incident_id_idx" ON "production_attachments"("incident_id");
CREATE INDEX "production_activities_production_order_id_created_at_idx" ON "production_activities"("production_order_id", "created_at");
CREATE INDEX "production_activities_production_item_id_created_at_idx" ON "production_activities"("production_item_id", "created_at");
CREATE INDEX "production_activities_type_idx" ON "production_activities"("type");
CREATE INDEX "production_time_sessions_user_id_status_idx" ON "production_time_sessions"("user_id", "status");
CREATE INDEX "production_time_sessions_process_id_status_idx" ON "production_time_sessions"("process_id", "status");
CREATE INDEX "production_time_sessions_production_item_id_idx" ON "production_time_sessions"("production_item_id");
CREATE INDEX "production_incidents_production_order_id_status_idx" ON "production_incidents"("production_order_id", "status");
CREATE INDEX "production_incidents_production_item_id_status_idx" ON "production_incidents"("production_item_id", "status");
CREATE INDEX "production_incidents_blocking_status_idx" ON "production_incidents"("blocking", "status");
CREATE INDEX "production_extra_materials_production_order_id_idx" ON "production_extra_materials"("production_order_id");
CREATE INDEX "production_extra_materials_production_item_id_idx" ON "production_extra_materials"("production_item_id");
CREATE INDEX "production_schedule_changes_production_item_id_created_at_idx" ON "production_schedule_changes"("production_item_id", "created_at");

-- FKs
ALTER TABLE "production_settings"
ADD CONSTRAINT "production_settings_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_items"
ADD CONSTRAINT "production_items_assigned_to_user_id_fkey"
FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_items"
ADD CONSTRAINT "production_items_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_item_processes"
ADD CONSTRAINT "production_item_processes_assigned_to_user_id_fkey"
FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_attachments"
ADD CONSTRAINT "production_attachments_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_attachments"
ADD CONSTRAINT "production_attachments_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "production_item_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_attachments"
ADD CONSTRAINT "production_attachments_incident_id_fkey"
FOREIGN KEY ("incident_id") REFERENCES "production_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_attachments"
ADD CONSTRAINT "production_attachments_activity_id_fkey"
FOREIGN KEY ("activity_id") REFERENCES "production_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_production_order_id_fkey"
FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "production_item_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_incident_id_fkey"
FOREIGN KEY ("incident_id") REFERENCES "production_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_extra_material_id_fkey"
FOREIGN KEY ("extra_material_id") REFERENCES "production_extra_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_activities"
ADD CONSTRAINT "production_activities_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_time_sessions"
ADD CONSTRAINT "production_time_sessions_production_order_id_fkey"
FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_time_sessions"
ADD CONSTRAINT "production_time_sessions_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_time_sessions"
ADD CONSTRAINT "production_time_sessions_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "production_item_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_time_sessions"
ADD CONSTRAINT "production_time_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_production_order_id_fkey"
FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "production_item_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_extra_material_id_fkey"
FOREIGN KEY ("extra_material_id") REFERENCES "production_extra_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_reported_by_fkey"
FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_incidents"
ADD CONSTRAINT "production_incidents_assigned_to_user_id_fkey"
FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_production_order_id_fkey"
FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "production_item_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_catalog_item_id_fkey"
FOREIGN KEY ("catalog_item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_extra_materials"
ADD CONSTRAINT "production_extra_materials_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_schedule_changes"
ADD CONSTRAINT "production_schedule_changes_production_item_id_fkey"
FOREIGN KEY ("production_item_id") REFERENCES "production_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_schedule_changes"
ADD CONSTRAINT "production_schedule_changes_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Production operator loses close-order / process-admin; Supervisor gains floor control.
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
SELECT gen_random_uuid()::text, 'production', v.action, v.code, v.description
FROM (VALUES
  ('assign_responsible', 'production.assign_responsible', 'Asignar responsable - Produccion'),
  ('manage_planning', 'production.manage_planning', 'Administrar planeacion - Produccion'),
  ('manage_handicap', 'production.manage_handicap', 'Configurar handicap - Produccion'),
  ('manage_incidents', 'production.manage_incidents', 'Administrar incidencias - Produccion'),
  ('record_sessions', 'production.record_sessions', 'Registrar sesiones de tiempo - Produccion'),
  ('record_extra_materials', 'production.record_extra_materials', 'Registrar materiales adicionales - Produccion')
) AS v(action, code, description)
WHERE NOT EXISTS (SELECT 1 FROM "permissions" p WHERE p.code = v.code);

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.module = 'production'
WHERE r.name = 'Administrador'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'production.assign_responsible',
  'production.manage_planning',
  'production.manage_handicap',
  'production.manage_incidents',
  'production.record_sessions',
  'production.record_extra_materials',
  'production.start',
  'production.update_progress',
  'production.complete_item',
  'production.complete_order',
  'production.reopen_item',
  'production.manage_processes',
  'production.record_process_hours',
  'production.cancel',
  'production.print'
)
WHERE r.name = 'Supervisor'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'Produccion'
  AND r.deleted_at IS NULL
  AND p.code IN (
    'production.complete_item',
    'production.complete_order',
    'production.reopen_item',
    'production.manage_processes',
    'production.cancel',
    'production.assign_responsible',
    'production.manage_planning',
    'production.manage_handicap',
    'production.record_extra_materials'
  );

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'production.manage_incidents',
  'production.record_sessions'
)
WHERE r.name = 'Produccion'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
