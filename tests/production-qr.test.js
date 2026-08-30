import test from "node:test";
import assert from "node:assert/strict";
import { productionScanPath, productionScanUrl } from "../domains/production/qr.js";
import {
  nextPendingProcess,
  resolveScanSessionAction,
  findUserOpenSession,
} from "../domains/production/process-rules.js";

test("productionScanPath genera ruta de escaneo", () => {
  assert.equal(
    productionScanPath("ord1", "item1"),
    "/produccion/escaneo/ord1/item1"
  );
  assert.equal(
    productionScanUrl("https://erp.ejemplo.com", "ord1", "item1"),
    "https://erp.ejemplo.com/produccion/escaneo/ord1/item1"
  );
});

test("nextPendingProcess devuelve el primer proceso pendiente", () => {
  const proc = nextPendingProcess([
    { status: "COMPLETED", sortOrder: 1 },
    { status: "PENDING", id: "p2", sortOrder: 2 },
    { status: "PENDING", id: "p3", sortOrder: 3 },
  ]);
  assert.equal(proc.id, "p2");
});

test("resolveScanSessionAction alterna inicio y fin", () => {
  const process = { id: "p1", status: "PENDING" };
  assert.deepEqual(resolveScanSessionAction(process, "u1"), {
    action: "start",
    processId: "p1",
  });
  const running = {
    ...process,
    sessions: [{ userId: "u1", status: "RUNNING" }],
  };
  assert.deepEqual(resolveScanSessionAction(running, "u1"), {
    action: "end",
    processId: "p1",
  });
  const paused = {
    ...process,
    sessions: [{ userId: "u1", status: "PAUSED" }],
  };
  assert.deepEqual(resolveScanSessionAction(paused, "u1"), {
    action: "resume",
    processId: "p1",
  });
  assert.equal(findUserOpenSession(running, "u1")?.status, "RUNNING");
});
