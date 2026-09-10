import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
  buildPermissionList,
} from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";

test("catalogo incluye permisos de teams", () => {
  const codes = new Set(buildPermissionList().map((p) => p.code));
  assert.ok(codes.has("teams.view"));
  assert.ok(codes.has("teams.create"));
  assert.ok(codes.has("teams.edit"));
  assert.ok(codes.has("teams.delete"));
});

test("ALL_PERMISSION_CODES incluye teams", () => {
  assert.ok(ALL_PERMISSION_CODES.includes("teams.view"));
});

test("Direccion y Administracion tienen teams", () => {
  const direccion = SYSTEM_ROLES.find((r) => r.name === "Direccion");
  const adminOps = SYSTEM_ROLES.find((r) => r.name === "Administracion");
  assert.ok(direccion.permissions.includes("teams.view"));
  assert.ok(direccion.permissions.includes("teams.edit"));
  assert.ok(adminOps.permissions.includes("teams.view"));
  assert.ok(adminOps.permissions.includes("teams.create"));
});

test("menu muestra Equipos con permiso", () => {
  const menu = buildMenu(["dashboard.view", "teams.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/equipos"));
});

test("seller scoped une peers del equipo (simulacion)", () => {
  const self = "u1";
  const memberships = [
    { userId: "u1", teamId: "t1" },
    { userId: "u2", teamId: "t1" },
    { userId: "u3", teamId: "t2" },
  ];
  const myTeams = memberships.filter((m) => m.userId === self).map((m) => m.teamId);
  const peerIds = [
    ...new Set(
      memberships.filter((m) => myTeams.includes(m.teamId)).map((m) => m.userId)
    ),
  ];
  assert.deepEqual(peerIds.sort(), ["u1", "u2"]);
});

test("meta de ventas exige equipo o vendedor (regla)", () => {
  function validGoal({ sellerIds = [], teamIds = [] }) {
    return sellerIds.length > 0 || teamIds.length > 0;
  }
  assert.equal(validGoal({ teamIds: ["t1"] }), true);
  assert.equal(validGoal({ sellerIds: ["u1"] }), true);
  assert.equal(validGoal({ sellerIds: [], teamIds: [] }), false);
});

test("union de permisos: equipo + individual (simulacion)", () => {
  // Mirrors loadUserAuthContext: Set union of direct + team roles.
  const direct = ["quotes.view", "quotes.create"];
  const fromTeam = ["sales.view", "quotes.view"];
  const effective = [...new Set([...direct, ...fromTeam])];
  assert.deepEqual(effective.sort(), ["quotes.create", "quotes.view", "sales.view"]);
});

test("rol de equipo inactivo no aporta permisos (simulacion)", () => {
  const roles = [
    { status: "ACTIVE", deletedAt: null, codes: ["sales.view"] },
    { status: "INACTIVE", deletedAt: null, codes: ["users.view"] },
    { status: "ACTIVE", deletedAt: new Date(), codes: ["roles.view"] },
  ];
  const permissionSet = new Set();
  for (const role of roles) {
    if (!role || role.deletedAt || role.status !== "ACTIVE") continue;
    for (const code of role.codes) permissionSet.add(code);
  }
  assert.deepEqual([...permissionSet], ["sales.view"]);
});

test("usuario fuera del equipo no hereda (simulacion)", () => {
  const memberships = [
    { userId: "u1", teamId: "t1" },
    { userId: "u2", teamId: "t1" },
  ];
  const teamRoles = [{ teamId: "t1", codes: ["production.view"] }];
  const userId = "u3";
  const teamIds = memberships
    .filter((m) => m.userId === userId)
    .map((m) => m.teamId);
  const codes = teamRoles
    .filter((tr) => teamIds.includes(tr.teamId))
    .flatMap((tr) => tr.codes);
  assert.equal(codes.length, 0);
});
