import test from "node:test";
import assert from "node:assert/strict";
import {
  excelColumnLabel,
  nextAnnotationLabel,
  calculateMeasurementResult,
  clampNormalized,
  computeQualityStatus,
  summarizeAnnotations,
  isPdfFile,
} from "../domains/quality/calculations.js";
import { SYSTEM_ROLES, ALL_PERMISSION_CODES } from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";

test("excelColumnLabel genera A, Z, AA, AB", () => {
  assert.equal(excelColumnLabel(0), "A");
  assert.equal(excelColumnLabel(25), "Z");
  assert.equal(excelColumnLabel(26), "AA");
  assert.equal(excelColumnLabel(27), "AB");
});

test("nextAnnotationLabel no reutiliza etiquetas existentes", () => {
  assert.equal(nextAnnotationLabel([]), "A");
  assert.equal(nextAnnotationLabel(["A", "B"]), "C");
  assert.equal(nextAnnotationLabel(["A", "B", "C"]), "D");
  assert.equal(nextAnnotationLabel(["A", "Z"]), "B");
  assert.equal(nextAnnotationLabel(["A", "B", "C", "Z"]), "D");
  const used = [];
  for (let i = 0; i < 26; i += 1) used.push(excelColumnLabel(i));
  assert.equal(nextAnnotationLabel(used), "AA");
});

test("calculateMeasurementResult marca PASS dentro de tolerancia", () => {
  const result = calculateMeasurementResult({
    nominalValue: 21.38,
    measuredValue: 21.36,
    upperTolerance: 0.03,
    lowerTolerance: 0.03,
  });
  assert.equal(result.result, "PASS");
  assert.equal(result.minimum, 21.35);
  assert.equal(result.maximum, 21.41);
});

test("calculateMeasurementResult marca FAIL fuera de tolerancia", () => {
  const result = calculateMeasurementResult({
    nominalValue: 21.38,
    measuredValue: 21.44,
    upperTolerance: 0.03,
    lowerTolerance: 0.03,
  });
  assert.equal(result.result, "FAIL");
});

test("calculateMeasurementResult soporta tolerancias asimetricas", () => {
  const result = calculateMeasurementResult({
    nominalValue: 10,
    measuredValue: 9.96,
    upperTolerance: 0.1,
    lowerTolerance: 0.05,
  });
  assert.equal(result.minimum, 9.95);
  assert.equal(result.maximum, 10.1);
  assert.equal(result.result, "PASS");

  const failLow = calculateMeasurementResult({
    nominalValue: 10,
    measuredValue: 9.94,
    upperTolerance: 0.1,
    lowerTolerance: 0.05,
  });
  assert.equal(failLow.result, "FAIL");

  const passHigh = calculateMeasurementResult({
    nominalValue: 10,
    measuredValue: 10.1,
    upperTolerance: 0.1,
    lowerTolerance: 0.05,
  });
  assert.equal(passHigh.result, "PASS");
});

test("calculateMeasurementResult usa valor absoluto de tolerancias negativas", () => {
  const result = calculateMeasurementResult({
    nominalValue: 10,
    measuredValue: 9.96,
    upperTolerance: 0.1,
    lowerTolerance: -0.05,
  });
  assert.equal(result.minimum, 9.95);
  assert.equal(result.result, "PASS");
});

test("clampNormalized acepta 0..1 y rechaza fuera de rango", () => {
  assert.equal(clampNormalized(0), 0);
  assert.equal(clampNormalized(1), 1);
  assert.equal(clampNormalized(0.7254), 0.7254);
  assert.throws(() => clampNormalized(-0.01));
  assert.throws(() => clampNormalized(1.01));
  assert.throws(() => clampNormalized("abc"));
});

test("computeQualityStatus deriva el estado de la ultima inspeccion", () => {
  assert.equal(computeQualityStatus([]), "NOT_INSPECTED");
  assert.equal(computeQualityStatus([{ status: "DRAFT" }]), "IN_PROGRESS");
  assert.equal(computeQualityStatus([{ status: "IN_PROGRESS" }]), "IN_PROGRESS");
  assert.equal(computeQualityStatus([{ status: "COMPLETED" }]), "PASSED");
  assert.equal(computeQualityStatus([{ status: "REJECTED" }]), "FAILED");
  assert.equal(
    computeQualityStatus([{ status: "IN_PROGRESS" }, { status: "COMPLETED" }]),
    "IN_PROGRESS"
  );
});

test("summarizeAnnotations cuenta tipos y resultados", () => {
  const summary = summarizeAnnotations([
    { annotationType: "MEASUREMENT", measurement: { result: "PASS" } },
    { annotationType: "MEASUREMENT", status: "FAIL", measurement: { result: "FAIL" } },
    { annotationType: "COMMENT" },
    { annotationType: "COMMENT" },
    { annotationType: "OBSERVATION" },
    { annotationType: "MEASUREMENT", deletedAt: new Date(), measurement: { result: "FAIL" } },
  ]);
  assert.equal(summary.annotationCount, 5);
  assert.equal(summary.measurementsPassed, 1);
  assert.equal(summary.measurementsFailed, 1);
  assert.equal(summary.comments, 2);
  assert.equal(summary.observations, 1);
});

test("isPdfFile reconoce PDF por tipo o extension", () => {
  assert.equal(isPdfFile("plano.pdf", "application/pdf"), true);
  assert.equal(isPdfFile("PLANO.PDF", "application/octet-stream"), true);
  assert.equal(isPdfFile("pieza.step", "application/octet-stream"), false);
});

test("catalogo incluye permisos quality.*", () => {
  const expected = [
    "quality.view",
    "quality.create",
    "quality.edit",
    "quality.complete",
    "quality.annotate",
    "quality.edit_annotation",
    "quality.move_annotation",
    "quality.delete_annotation",
    "quality.print",
    "quality.view_history",
  ];
  for (const code of expected) {
    assert.ok(ALL_PERMISSION_CODES.includes(code), `Falta ${code}`);
  }
});

test("rol Calidad tiene quality.* y no completa produccion", () => {
  const role = SYSTEM_ROLES.find((r) => r.name === "Calidad");
  assert.ok(role);
  assert.ok(role.permissions.includes("quality.view"));
  assert.ok(role.permissions.includes("quality.annotate"));
  assert.ok(role.permissions.includes("quality.complete"));
  assert.ok(role.permissions.includes("production.view"));
  assert.ok(!role.permissions.includes("production.complete_item"));
  assert.ok(!role.permissions.includes("production.complete_order"));
});

test("rol Produccion solo ve calidad, no edita incisos", () => {
  const role = SYSTEM_ROLES.find((r) => r.name === "Produccion");
  assert.ok(role.permissions.includes("quality.view"));
  assert.ok(!role.permissions.includes("quality.annotate"));
  assert.ok(!role.permissions.includes("quality.complete"));
});

test("buildMenu muestra Calidad con quality.view", () => {
  const withPerm = buildMenu(["dashboard.view", "quality.view"]);
  const hrefs = withPerm.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/calidad"));

  const without = buildMenu(["dashboard.view", "production.view"]);
  const hrefsNo = without.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(!hrefsNo.includes("/calidad"));
});
