-- production.print existia en el catalogo pero nunca se inserto en permisos; sin el,
-- la descarga de control dimensional y orden de trabajo responde 403 para todos.
INSERT INTO "permissions" ("id", "module", "action", "code", "description")
VALUES (
  concat('perm_', md5(random()::text || clock_timestamp()::text), '_print'),
  'production',
  'print',
  'production.print',
  'Imprimir formatos - Produccion'
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" = 'production.print'
  AND r."name" IN ('Administrador', 'Supervisor', 'Produccion', 'Direccion')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- El rol Administrador debe conservar acceso total cuando se agregan permisos nuevos.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'Administrador'
  AND r."deleted_at" IS NULL
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
