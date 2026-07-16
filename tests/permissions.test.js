import test from "node:test";
import assert from "node:assert/strict";
import {
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../lib/permissions/errors.js";
import {
  buildPermissionList,
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
} from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";

test("ForbiddenError expone status 403", () => {
  const err = new ForbiddenError("nope", "users.create");
  assert.equal(err.status, 403);
  assert.equal(err.permission, "users.create");
});

test("UnauthorizedError expone status 401", () => {
  assert.equal(new UnauthorizedError().status, 401);
});

test("Otros errores mapean sus status", () => {
  assert.equal(new NotFoundError().status, 404);
  assert.equal(new ConflictError().status, 409);
});

test("El catalogo de permisos no tiene codigos duplicados", () => {
  const codes = buildPermissionList().map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("Cada permiso tiene formato modulo.accion", () => {
  for (const p of buildPermissionList()) {
    assert.equal(p.code, `${p.module}.${p.action}`);
  }
});

test("Los roles del sistema referencian permisos existentes", () => {
  const valid = new Set(ALL_PERMISSION_CODES);
  for (const role of SYSTEM_ROLES) {
    if (role.permissions === "ALL") continue;
    for (const code of role.permissions) {
      assert.ok(valid.has(code), `Codigo invalido "${code}" en rol ${role.name}`);
    }
  }
});

test("El administrador obtiene todos los permisos", () => {
  const admin = SYSTEM_ROLES.find((r) => r.name === "Administrador");
  assert.equal(admin.permissions, "ALL");
});

test("buildMenu oculta modulos sin permiso (Ventas no ve Usuarios)", () => {
  const menu = buildMenu(["dashboard.view", "clients.view", "items.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/clientes"));
  assert.ok(!hrefs.includes("/usuarios"));
  assert.ok(!hrefs.includes("/roles"));
});

test("buildMenu muestra Administracion al tener permisos", () => {
  const menu = buildMenu(ALL_PERMISSION_CODES);
  const sectionIds = menu.map((s) => s.id);
  assert.ok(sectionIds.includes("administracion"));
  assert.ok(sectionIds.includes("catalogos"));
});

test("buildMenu vacio cuando no hay permisos", () => {
  assert.equal(buildMenu([]).length, 0);
});
