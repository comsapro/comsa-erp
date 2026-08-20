-- Permiso para que piso agregue procesos no cotizados sin poder reemplazarlos ni
-- eliminarlos (eso sigue en production.manage_processes).
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
VALUES (
  concat('perm_', md5(random()::text || clock_timestamp()::text), '_addproc'),
  'production',
  'add_process',
  'production.add_process',
  'Agregar proceso no cotizado - Produccion'
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" = 'production.add_process'
  AND r."name" IN ('Administrador', 'Supervisor', 'Produccion')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
