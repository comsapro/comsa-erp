import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedHoursFromQuoted,
  clampHandicapPercent,
  hoursEfficiency,
  canRecalcExpectedHours,
} from "../domains/production/handicap.js";
import {
  canCompleteProcess,
  canCompleteItem,
  canCompleteOrder,
  hasBlockingIncidents,
} from "../domains/production/close-rules.js";
import { sessionsHours, itemHoursSummary } from "../domains/production/process-rules.js";
import { buildMenu } from "../lib/navigation/menu.js";

test("Handicap 20% sobre 10h da 8h objetivo", () => {
  assert.equal(expectedHoursFromQuoted(10, 20), 8);
  assert.equal(clampHandicapPercent(120), 90);
});

test("Eficiencia negativa si se excede el objetivo", () => {
  const e = hoursEfficiency(10, 8, 10);
  assert.equal(e.diffExpected, 2);
  assert.ok(e.efficiencyVsExpected < 0);
});

test("No recalcula esperado si el proceso ya arranco", () => {
  assert.equal(canRecalcExpectedHours({ status: "PENDING", realHours: 1 }), false);
  assert.equal(canRecalcExpectedHours({ status: "PENDING", realHours: 0 }), true);
});

test("Cierre de proceso exige responsable y horas o sesion", () => {
  assert.equal(
    canCompleteProcess({ status: "PENDING", assignedToUserId: null, realHours: 2 }).ok,
    false
  );
  assert.equal(
    canCompleteProcess({
      status: "PENDING",
      assignedToUserId: "u1",
      realHours: 0,
      sessions: [{ status: "CLOSED" }],
    }).ok,
    true
  );
});

test("Incidencia bloqueante impide cerrar partida y orden", () => {
  const incidents = [{ blocking: true, status: "OPEN" }];
  assert.equal(hasBlockingIncidents(incidents), true);
  assert.equal(
    canCompleteItem({
      status: "IN_PROGRESS",
      assignedToUserId: "u1",
      processes: [{ status: "COMPLETED" }],
      incidents,
    }).ok,
    false
  );
  assert.equal(
    canCompleteOrder({
      items: [{ status: "COMPLETED", incidents }],
      incidents,
    }).ok,
    false
  );
});

test("Suma de sesiones RUNNING incluye tiempo transcurrido", () => {
  const now = new Date("2026-08-15T12:00:00Z");
  const hours = sessionsHours(
    [
      {
        status: "RUNNING",
        accumulatedMinutes: 30,
        lastResumedAt: new Date("2026-08-15T11:00:00Z"),
      },
    ],
    now
  );
  assert.equal(hours, 1.5);
});

test("Resumen de horas ignora procesos REPLACED", () => {
  const s = itemHoursSummary([
    { status: "PENDING", quotedHours: 2, expectedHours: 1.6, realHours: 1 },
    { status: "REPLACED", quotedHours: 9, expectedHours: 9, realHours: 9 },
  ]);
  assert.equal(s.quotedHours, 2);
  assert.equal(s.expectedHours, 1.6);
});

test("Menu de produccion incluye tablero gantt y calendario", () => {
  const menu = buildMenu(["dashboard.view", "production.view"]);
  const hrefs = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/produccion"));
  assert.ok(hrefs.includes("/produccion/tablero"));
  assert.ok(hrefs.includes("/produccion/gantt"));
  assert.ok(hrefs.includes("/produccion/calendario"));
});
