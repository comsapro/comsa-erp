import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_ROLES, ALL_PERMISSION_CODES } from "../lib/permissions/catalog.js";
import {
  computeProgress,
  canOrderBeCompleted,
  deriveOrderStatus,
} from "../domains/production/progress.js";
import {
  canDeleteProductionProcess,
  workOrderProcessSections,
  allActiveProcessesCompleted,
  itemHoursSummary,
} from "../domains/production/process-rules.js";
import {
  mapSelectedMaterials,
  dedupeBySourceMaterial,
} from "../domains/purchase-orders/preload.js";
import { buildWorkOrderModel } from "../lib/pdf/production-docs.js";

test("Rol Produccion no incluye quotes.view y si reopen_item", () => {
  const prod = SYSTEM_ROLES.find((r) => r.name === "Produccion");
  assert.ok(prod);
  assert.ok(!prod.permissions.includes("quotes.view"));
  assert.ok(prod.permissions.includes("production.reopen_item"));
  assert.ok(prod.permissions.includes("production.manage_processes"));
  assert.ok(prod.permissions.includes("production.record_process_hours"));
});

test("Catalogo incluye los nuevos permisos de produccion", () => {
  for (const code of [
    "production.reopen_item",
    "production.manage_processes",
    "production.record_process_hours",
  ]) {
    assert.ok(ALL_PERMISSION_CODES.includes(code), `Falta ${code}`);
  }
});

test("computeProgress ignora REWORK como completado", () => {
  const progress = computeProgress([
    { status: "COMPLETED" },
    { status: "REWORK" },
    { status: "CANCELLED" },
  ]);
  assert.equal(progress.totalItems, 2);
  assert.equal(progress.completedItems, 1);
  assert.equal(progress.progressPercentage, 50);
});

test("Orden no puede quedar COMPLETED con item REWORK", () => {
  assert.equal(
    canOrderBeCompleted([{ status: "COMPLETED" }, { status: "REWORK" }]),
    false
  );
  assert.equal(
    deriveOrderStatus("COMPLETED", [
      { status: "COMPLETED" },
      { status: "REWORK" },
    ]),
    "IN_PROGRESS"
  );
});

test("Precarga copia solo seleccionados y sin precio de venta", () => {
  const available = [
    {
      id: "m1",
      itemId: "i1",
      descriptionSnapshot: "A-36",
      quantity: 2,
      unit: "PZA",
      unitPrice: 99,
    },
    {
      id: "m2",
      itemId: "i2",
      descriptionSnapshot: "Aluminio",
      quantity: 1,
      unit: "PZA",
      unitPrice: 50,
    },
  ];
  const mapped = mapSelectedMaterials(available, ["m1"]);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].descriptionSnapshot, "A-36");
  assert.equal(mapped[0].unitPrice, 0);
  assert.equal(mapped[0].sourceMaterialId, "m1");
});

test("Precarga no duplica sourceMaterialId", () => {
  const lines = [
    { sourceMaterialId: "m1", itemId: "a" },
    { sourceMaterialId: "m1", itemId: "b" },
    { itemId: "c" },
  ];
  const unique = dedupeBySourceMaterial(lines);
  assert.equal(unique.length, 2);
});

test("OT emite una seccion por proceso activo", () => {
  const sections = workOrderProcessSections([
    { processNameSnapshot: "Laser", status: "PENDING", sourceType: "QUOTATION" },
    { processNameSnapshot: "Doblez", status: "PENDING", sourceType: "QUOTATION" },
    { processNameSnapshot: "CNC", status: "PENDING", sourceType: "PRODUCTION" },
    { processNameSnapshot: "Viejo", status: "REPLACED", sourceType: "QUOTATION" },
  ]);
  assert.equal(sections.length, 3);
  assert.deepEqual(
    sections.map((s) => s.name),
    ["Laser", "Doblez", "CNC"]
  );

  const model = buildWorkOrderModel(
    { folio: "2608-13", approvalDate: "2026-08-06", client: { commercialName: "SIGRAMA" } },
    {
      description: "11-E-9851-02",
      quantity: 530,
      processes: [
        { processNameSnapshot: "CORTE LASER", status: "PENDING", quotedHours: 0.08 },
        { processNameSnapshot: "Doblez", status: "PENDING", quotedHours: 0.09 },
      ],
      sourceMaterials: [],
    }
  );
  assert.equal(model.processes.length, 2);
  assert.equal(model.productionFolio, "2608-13");
  assert.equal(model.pieceName, "11-E-9851-02");
});

test("Proceso QUOTATION no es deletable; PRODUCTION si sin horas", () => {
  assert.equal(
    canDeleteProductionProcess({
      sourceType: "QUOTATION",
      status: "PENDING",
      realHours: 0,
    }),
    false
  );
  assert.equal(
    canDeleteProductionProcess({
      sourceType: "PRODUCTION",
      status: "PENDING",
      realHours: 0,
    }),
    true
  );
  assert.equal(
    canDeleteProductionProcess({
      sourceType: "PRODUCTION",
      status: "PENDING",
      realHours: 1.5,
    }),
    false
  );
});

test("Horas reales se suman en DECIMAL-safe rounding", () => {
  const summary = itemHoursSummary([
    { quotedHours: "1.250", realHours: "1.500", status: "PENDING" },
    { quotedHours: "0.080", realHours: "0.090", status: "COMPLETED" },
    { quotedHours: "2.000", realHours: "2.000", status: "REPLACED" },
  ]);
  assert.equal(summary.quotedHours, 1.33);
  assert.equal(summary.realHours, 1.59);
});

test("Completar item exige procesos activos completados", () => {
  assert.equal(
    allActiveProcessesCompleted([
      { status: "COMPLETED" },
      { status: "REPLACED" },
    ]),
    true
  );
  assert.equal(
    allActiveProcessesCompleted([{ status: "PENDING" }]),
    false
  );
});
