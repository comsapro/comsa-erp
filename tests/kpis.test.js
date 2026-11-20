import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import {
  resolvePeriod,
  previousPeriod,
  weekRange,
  isoWeek,
  buildBuckets,
  trailingBuckets,
  todayKey,
  diffDays,
  overlapDays,
  asOfKey,
} from "../domains/kpis/periods.js";
import {
  resolveTrackingStatus,
  classifyCommitments,
  goalTargetsForRange,
  salesProgress,
  receptionStats,
  pendingReceptionHistory,
  collectionStats,
  dueDateKey,
  errorCost,
  qualityStats,
  delta,
  matchCatalogCode,
  suggestResponsible,
  openBlockingByItem,
} from "../domains/kpis/calculations.js";
import { buildXlsx, crc32 } from "../lib/export/xlsx.js";
import { SYSTEM_ROLES, ALL_PERMISSION_CODES } from "../lib/permissions/catalog.js";
import { buildMenu } from "../lib/navigation/menu.js";

const NOW = new Date("2026-09-24T18:00:00.000Z"); // jueves 24 sep 2026, 12:00 CDMX

// --- Periodos ------------------------------------------------------------------

test("todayKey usa hora de negocio (UTC-6)", () => {
  assert.equal(todayKey(new Date("2026-09-25T03:00:00.000Z")), "2026-09-24");
  assert.equal(todayKey(new Date("2026-09-25T07:00:00.000Z")), "2026-09-25");
});

test("resolvePeriod: mes actual por defecto", () => {
  const p = resolvePeriod({}, NOW);
  assert.equal(p.type, "month");
  assert.equal(p.from, "2026-09-01");
  assert.equal(p.to, "2026-09-30");
  assert.equal(p.label, "Septiembre 2026");
});

test("resolvePeriod: mes anterior cruza año", () => {
  const p = resolvePeriod({ period: "prev_month" }, new Date("2026-01-10T18:00:00Z"));
  assert.equal(p.from, "2025-12-01");
  assert.equal(p.to, "2025-12-31");
});

test("resolvePeriod: trimestre, semestre, año y personalizado", () => {
  assert.deepEqual(
    [resolvePeriod({ period: "quarter", quarter: 3, year: 2026 }, NOW)].map((p) => [p.from, p.to, p.label])[0],
    ["2026-07-01", "2026-09-30", "Q3 2026"]
  );
  const h = resolvePeriod({ period: "semester", half: 2, year: 2026 }, NOW);
  assert.equal(h.from, "2026-07-01");
  assert.equal(h.to, "2026-12-31");
  const y = resolvePeriod({ period: "year", year: 2025 }, NOW);
  assert.equal(y.to, "2025-12-31");
  const c = resolvePeriod({ period: "custom", from: "2026-09-15", to: "2026-08-01" }, NOW);
  assert.deepEqual([c.from, c.to], ["2026-08-01", "2026-09-15"]);
});

test("resolvePeriod: personalizado invalido cae a mes actual", () => {
  const p = resolvePeriod({ period: "custom", from: "x", to: "2026-01-01" }, NOW);
  assert.equal(p.type, "month");
});

test("semana ISO lunes-domingo", () => {
  assert.deepEqual(weekRange("2026-09-24"), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(weekRange("2026-09-27"), { from: "2026-09-21", to: "2026-09-27" });
  assert.equal(isoWeek("2026-09-28").week, 40);
  const w = resolvePeriod({ period: "week", date: "2026-09-30" }, NOW);
  assert.equal(w.from, "2026-09-28");
  assert.equal(w.week, 40);
});

test("previousPeriod: mes, trimestre, semana y personalizado", () => {
  const sep = resolvePeriod({}, NOW);
  assert.deepEqual([previousPeriod(sep).from, previousPeriod(sep).to], ["2026-08-01", "2026-08-31"]);
  const q1 = resolvePeriod({ period: "quarter", quarter: 1, year: 2026 }, NOW);
  assert.equal(previousPeriod(q1).label, "Q4 2025");
  const custom = resolvePeriod({ period: "custom", from: "2026-08-01", to: "2026-08-10" }, NOW);
  const prev = previousPeriod(custom);
  assert.deepEqual([prev.from, prev.to], ["2026-07-22", "2026-07-31"]);
});

test("asOfKey no rebasa hoy", () => {
  const sep = resolvePeriod({}, NOW);
  assert.equal(asOfKey(sep, NOW), "2026-09-24");
  const aug = resolvePeriod({ period: "prev_month" }, NOW);
  assert.equal(asOfKey(aug, NOW), "2026-08-31");
});

test("buckets por semana y mes", () => {
  const months = buildBuckets("2026-07-15", "2026-09-02", "month");
  assert.deepEqual(months.map((b) => b.key), ["2026-07", "2026-08", "2026-09"]);
  const weeks = buildBuckets("2026-09-01", "2026-09-30", "week");
  assert.equal(weeks[0].from, "2026-08-31");
  assert.equal(weeks.length, 5);
  assert.equal(trailingBuckets("2026-09-24", "month", 12).length, 12);
  assert.equal(trailingBuckets("2026-09-24", "week", 8).length, 8);
});

test("diffDays y overlapDays", () => {
  assert.equal(diffDays("2026-07-22", "2026-07-24"), 2);
  assert.equal(overlapDays({ from: "2026-09-01", to: "2026-09-30" }, { from: "2026-09-21", to: "2026-10-04" }), 10);
});

// --- KPI 1 ---------------------------------------------------------------------

test("resolveTrackingStatus deriva estatus y retraso", () => {
  const today = "2026-09-24";
  assert.equal(resolveTrackingStatus({ status: "PENDING" }, today).status, "PENDING");
  assert.equal(resolveTrackingStatus({ status: "IN_PROGRESS" }, today).status, "IN_PRODUCTION");
  const late = resolveTrackingStatus({ status: "IN_PROGRESS", commitmentDate: "2026-09-20" }, today);
  assert.equal(late.status, "DELAYED");
  assert.equal(late.baseStatus, "IN_PRODUCTION");
  assert.equal(late.daysLate, 4);
  assert.equal(
    resolveTrackingStatus({ status: "COMPLETED", commitmentDate: "2026-09-20" }, today).status,
    "FINISHED"
  );
  assert.equal(
    resolveTrackingStatus(
      { status: "COMPLETED", quality: { inspectionStatus: "IN_PROGRESS", requestedQty: 4, releasedQty: 1 } },
      today
    ).status,
    "IN_QUALITY"
  );
  assert.equal(
    resolveTrackingStatus(
      { status: "COMPLETED", quality: { inspectionStatus: "PENDING", requestedQty: 4, releasedQty: 4 } },
      today
    ).status,
    "RELEASED"
  );
});

test("resolveTrackingStatus: incidencia bloqueante y entregado tienen prioridad", () => {
  const today = "2026-09-24";
  const stopped = resolveTrackingStatus(
    { status: "IN_PROGRESS", commitmentDate: "2026-09-01", openBlockingIncidents: 1 },
    today
  );
  assert.equal(stopped.status, "STOPPED");
  assert.equal(stopped.overdue, true);
  assert.equal(
    resolveTrackingStatus({ status: "IN_PROGRESS", deliveredAt: "2026-09-10", commitmentDate: "2026-09-01" }, today)
      .status,
    "DELIVERED"
  );
  assert.equal(resolveTrackingStatus({ status: "PENDING", trackingStatus: "IN_QUALITY" }, today).status, "IN_QUALITY");
});

test("classifyCommitments agrupa vencidos, semana, anterior y proximos", () => {
  const today = "2026-09-24";
  const mk = (id, commitmentDate, status = "IN_PROGRESS") => {
    const item = { id, commitmentDate, status };
    return { ...item, tracking: resolveTrackingStatus(item, today) };
  };
  const rows = [
    mk("a", "2026-09-22"), // vencido y de esta semana
    mk("b", "2026-09-26"), // esta semana, proximo
    mk("c", "2026-09-16", "COMPLETED"), // semana anterior, terminado
    mk("d", "2026-09-30"), // proxima semana
    mk("e", null, "PENDING"),
  ];
  const out = classifyCommitments(rows, { today, upcomingDays: 7 });
  assert.deepEqual(out.groups.overdue.map((r) => r.id), ["a"]);
  assert.deepEqual(out.groups.thisWeek.map((r) => r.id), ["a", "b"]);
  assert.deepEqual(out.groups.lastWeek.map((r) => r.id), ["c"]);
  assert.deepEqual(out.groups.nextWeek.map((r) => r.id), ["d"]);
  assert.deepEqual(out.groups.upcoming.map((r) => r.id), ["b", "d"]);
  assert.deepEqual(out.groups.pending.map((r) => r.id), ["e"]);
  assert.equal(out.counts.inProgress, 3);
});

test("openBlockingByItem y suggestResponsible", () => {
  const map = openBlockingByItem([
    { productionItemId: "i1", blocking: true, status: "OPEN" },
    { productionItemId: "i1", blocking: true, status: "RESOLVED" },
    { productionItemId: "i2", blocking: false, status: "OPEN" },
  ]);
  assert.equal(map.get("i1"), 1);
  assert.equal(map.has("i2"), false);
  assert.equal(suggestResponsible("SELLER", { sellerId: "s", assigneeId: "a" }), "s");
  assert.equal(suggestResponsible("ITEM_ASSIGNEE", { sellerId: "s", assigneeId: "a" }), "a");
  assert.equal(suggestResponsible("NONE", { sellerId: "s" }), null);
});

// --- KPI 2 ---------------------------------------------------------------------

test("metas: con/sin IVA y prorrateo semanal", () => {
  const goals = [
    { id: "g1", period: "MONTHLY", periodKey: "2026-09", amount: 2320000, amountIncludesTax: true, sellerIds: ["ivan", "omar"], memberIds: ["ivan", "omar"], names: "Iván + Omar" },
    { id: "g2", period: "MONTHLY", periodKey: "2026-09", amount: 535000, amountIncludesTax: false, sellerIds: ["teo"], memberIds: ["teo"], names: "Teo" },
    // Meta anual del mismo grupo: no debe sumarse si existe mensual.
    { id: "g3", period: "ANNUAL", periodKey: "2026", amount: 30000000, sellerIds: ["ivan", "omar"], memberIds: ["ivan", "omar"] },
  ];
  const month = { from: "2026-09-01", to: "2026-09-30" };
  const targets = goalTargetsForRange(goals, month, 16);
  assert.equal(targets.length, 2);
  assert.equal(targets.find((t) => t.label === "Iván + Omar").goalWithTax, 2320000);
  assert.equal(targets.find((t) => t.label === "Teo").goalWithTax, 620600);

  const week = { from: "2026-09-21", to: "2026-09-27" };
  const weekly = goalTargetsForRange(goals, week, 16);
  const ivan = weekly.find((t) => t.label === "Iván + Omar");
  assert.equal(ivan.prorated, true);
  assert.equal(ivan.goalWithTax, Math.round((2320000 * 7) / 30 * 100) / 100);
});

test("metas: rango sin mensual usa la siguiente granularidad prorrateada", () => {
  const goals = [{ id: "a", period: "QUARTERLY", periodKey: "2026-Q3", amount: 920000, memberIds: ["x"], sellerIds: ["x"] }];
  const t = goalTargetsForRange(goals, { from: "2026-07-01", to: "2026-07-31" }, 16);
  assert.equal(t[0].granularity, "QUARTERLY");
  assert.equal(t[0].goalWithTax, 310000);
});

test("salesProgress calcula avance, diferencia y facturas sin meta", () => {
  const targets = [
    { key: "a", label: "Vendedor A", goalWithTax: 2000000, memberIds: ["a"] },
    { key: "b", label: "Vendedor B", goalWithTax: 1000000, memberIds: ["b"] },
  ];
  const invoices = [
    { sellerId: "a", netAmount: 1850000 },
    { sellerId: "b", netAmount: 1200000 },
    { sellerId: "z", sellerName: "Zoe", netAmount: 100000 },
  ];
  const { rows, total } = salesProgress(targets, invoices, 16);
  assert.equal(rows[0].percent, 92.5);
  assert.equal(rows[1].percent, 120);
  assert.equal(rows[1].differenceWithTax, 200000);
  assert.equal(rows[2].unassigned, true);
  assert.match(rows[2].label, /Zoe/);
  assert.equal(total.goalWithTax, 3000000);
  assert.equal(total.billedWithTax, 3150000);
  assert.equal(total.percent, 105);
  assert.equal(total.billedWithoutTax, Math.round((3150000 / 1.16) * 100) / 100);
});

// --- KPI 3 ---------------------------------------------------------------------

test("receptionStats: tiempo medio y pendientes al corte", () => {
  const invoices = [
    { id: 1, clientId: "p", clientName: "Peñoles", invoiceDate: "2026-07-22", receptionDate: "2026-07-24", netAmount: 10 },
    { id: 2, clientId: "m", clientName: "Minera", invoiceDate: "2026-08-20", receptionDate: "2026-08-23", netAmount: 20 },
    { id: 3, clientId: "p", clientName: "Peñoles", invoiceDate: "2026-09-02", receptionDate: "2026-09-05", netAmount: 30 },
    { id: 4, clientId: "p", clientName: "Peñoles", invoiceDate: "2026-09-10", sentAt: "2026-09-12", netAmount: 40 },
    { id: 5, clientId: "m", clientName: "Minera", invoiceDate: "2026-09-01", receptionDate: "2026-09-30", netAmount: 50 },
  ];
  const range = { from: "2026-07-01", to: "2026-09-30" };
  const stats = receptionStats(invoices, range, "2026-09-24");
  assert.equal(stats.avgReceptionDays, 9.3); // (2+3+3+29)/4 = 9.25
  assert.deepEqual(stats.pending.map((p) => p.id).sort(), [4, 5]);
  assert.equal(stats.pending.find((p) => p.id === 4).daysPending, 12); // desde envio
  assert.equal(stats.pendingAmount, 90);
  assert.equal(stats.byClient[0].label, "Minera");

  const history = pendingReceptionHistory(
    invoices,
    [
      { key: "a", label: "ago", from: "2026-08-01", to: "2026-08-31" },
      { key: "s", label: "sep", from: "2026-09-01", to: "2026-09-30" },
    ],
    "2026-09-24"
  );
  assert.deepEqual(history.map((h) => h.amount), [0, 90]);
});

// --- KPI 4 ---------------------------------------------------------------------

test("dueDateKey usa fecha guardada o recepcion + credito", () => {
  assert.equal(dueDateKey({ dueDate: "2026-10-01" }), "2026-10-01");
  assert.equal(dueDateKey({ receptionDate: "2026-09-01", creditDays: 15 }), "2026-09-16");
  assert.equal(dueDateKey({ receptionDate: "2026-09-01" }, 30), "2026-10-01");
  assert.equal(dueDateKey({ invoiceDate: "2026-09-01" }), null);
});

test("collectionStats: vencidas, por vencer, pagos tardios y tiempos medios", () => {
  const invoices = [
    { id: "21289", clientId: "p", clientName: "Peñoles", invoiceDate: "2026-08-01", receptionDate: "2026-08-12", dueDate: "2026-09-11", netAmount: 20184 },
    { id: "21254", clientId: "l", clientName: "LALA", invoiceDate: "2026-08-05", receptionDate: "2026-08-16", dueDate: "2026-09-15", netAmount: 23258 },
    { id: "soon", clientId: "l", clientName: "LALA", invoiceDate: "2026-09-01", receptionDate: "2026-09-01", dueDate: "2026-09-28", netAmount: 1000 },
    { id: "late", clientId: "p", clientName: "Peñoles", invoiceDate: "2026-07-01", receptionDate: "2026-07-03", dueDate: "2026-08-02", paidAt: "2026-09-10", netAmount: 500 },
    { id: "ok", clientId: "p", clientName: "Peñoles", invoiceDate: "2026-08-20", receptionDate: "2026-08-25", dueDate: "2026-09-24", paidAt: "2026-09-20", netAmount: 700 },
    { id: "pending", clientId: "p", invoiceDate: "2026-09-20", netAmount: 999 },
  ];
  const range = { from: "2026-09-01", to: "2026-09-30" };
  const s = collectionStats(invoices, range, "2026-09-29", { dueSoonDays: 7 });
  assert.deepEqual(s.overdue.map((r) => [r.id, r.daysOverdue]), [["21289", 18], ["21254", 14], ["soon", 1]]);
  assert.equal(s.overdueAmount, 44442);
  assert.equal(s.overdueClients, 2);
  assert.deepEqual(s.paidLate.map((r) => [r.id, r.daysOverdue]), [["late", 39]]);
  assert.equal(s.avgInvoiceToPayment, 51); // 71 y 31
  assert.equal(s.avgReceptionToPayment, 47.5); // 69 y 26
  const early = collectionStats(invoices, range, "2026-09-24", { dueSoonDays: 7 });
  assert.deepEqual(early.dueSoon.map((r) => r.id), ["soon"]);
  assert.equal(early.distributionByClient[0].label, "LALA");
});

// --- KPI 5 ---------------------------------------------------------------------

test("errorCost suma mano de obra, materiales y otros sin duplicar retrabajo ligado", () => {
  const base = {
    costs: [
      { category: "LABOR", concept: "DIAGNOSIS", hours: 2 },
      { category: "LABOR", concept: "EXTRA_INSPECTION", hours: 1, hourlyRate: 500 },
      { category: "MATERIAL", concept: "MATERIAL_WASTE", amount: 1200 },
      { category: "OTHER", concept: "FREIGHT", amount: 300 },
    ],
    linkedReworkHours: 3,
  };
  const c = errorCost(base, 400);
  assert.deepEqual(c, { labor: 2 * 400 + 500 + 3 * 400, material: 1200, other: 300, total: 4000, hours: 6 });

  const manual = errorCost(
    { costs: [{ category: "LABOR", concept: "REWORK", hours: 5 }], linkedReworkHours: 3 },
    100
  );
  assert.equal(manual.labor, 500);
  assert.equal(manual.hours, 5);
});

test("qualityStats separa internos, Calidad y escapes al cliente", () => {
  const errors = [
    ...Array.from({ length: 18 }, (_, i) => ({ id: "q" + i, detectionStage: "QUALITY", areaCode: "CNC", areaLabel: "CNC", causeCode: "OPERATOR", causeLabel: "Error de operador", operatorName: i % 2 ? "Ana" : "Beto", operatorLabel: i % 2 ? "Ana" : "Beto", costs: [] })),
    { id: "p1", detectionStage: "PRODUCTION", areaCode: "TORNO", areaLabel: "Torno", costs: [] },
    { id: "p2", detectionStage: "PRODUCTION", costs: [{ category: "MATERIAL", amount: 1000 }] },
    { id: "c1", detectionStage: "CLIENT", areaCode: "CNC", areaLabel: "CNC", costs: [{ category: "OTHER", amount: 5000 }] },
    { id: "c2", detectionStage: "CLIENT", areaCode: "CLIENTE", areaLabel: "Cliente", costs: [] },
  ];
  const s = qualityStats(errors, { laborRate: 100, reworkCount: 7, reworkHours: 12.5 });
  assert.equal(s.totalErrors, 22);
  assert.equal(s.internalErrors, 20);
  assert.equal(s.detectedByQuality, 18);
  assert.equal(s.escapes, 2);
  assert.equal(s.totalCost, 6000);
  assert.equal(s.byArea[0].key, "CNC");
  assert.equal(s.byArea[0].count, 19);
  assert.equal(s.byOperator.find((o) => o.label === "Ana").count, 9);
  assert.equal(s.unclassified, 4);
  assert.equal(s.errors[0].id, "c1");
});

test("delta y matchCatalogCode", () => {
  assert.deepEqual(delta(18, 25), { current: 18, previous: 25, diff: -7, pct: -28 });
  assert.equal(delta(5, 0).pct, null);
  const areas = [{ code: "TORNO", label: "Torno" }, { code: "FRESADORA", label: "Fresadora" }];
  assert.equal(matchCatalogCode(" torno ", areas), "TORNO");
  assert.equal(matchCatalogCode("Fresadóra", areas), "FRESADORA");
  assert.equal(matchCatalogCode("CNC", areas), null);
});

// --- Excel ---------------------------------------------------------------------

function unzip(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const crc = buffer.readUInt32LE(offset + 14);
    const name = buffer.slice(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const data = inflateRawSync(buffer.slice(start, start + compressedSize));
    assert.equal(crc32(data), crc, "CRC de " + name);
    files[name] = data.toString("utf8");
    offset = start + compressedSize;
  }
  return files;
}

test("buildXlsx genera un ZIP valido con hojas, estilos y valores escapados", () => {
  const buf = buildXlsx([
    {
      name: "Cobranza/Vencidas",
      title: "Cobranza",
      subtitle: "Periodo: Septiembre 2026",
      columns: [
        { header: "Cliente", key: "client" },
        { header: "Monto", key: "amount", type: "money" },
        { header: "Días", value: (r) => r.days, type: "int" },
      ],
      rows: [{ client: "Peñoles & <Cía>", amount: 20184.5, days: 18 }],
    },
    { name: "Cobranza/Vencidas", columns: [{ header: "X", key: "x" }], rows: [] },
  ]);
  const files = unzip(buf);
  assert.ok(files["xl/workbook.xml"].includes('name="Cobranza Vencidas"'));
  assert.ok(files["xl/workbook.xml"].includes('name="Cobranza Vencidas 2"'));
  const sheet = files["xl/worksheets/sheet1.xml"];
  assert.ok(sheet.includes("Peñoles &amp; &lt;Cía&gt;"));
  assert.ok(sheet.includes("<v>20184.5</v>"));
  assert.ok(files["[Content_Types].xml"].includes("sheet2.xml"));
});

// --- Permisos y menu -----------------------------------------------------------

test("permisos KPI existen y se asignan a Direccion y Supervisor", () => {
  for (const code of ["kpis.view", "kpis.manage_incidents", "kpis.update_status", "kpis.manage_catalogs", "kpis.correct_data", "kpis.export", "quality.record_errors"]) {
    assert.ok(ALL_PERMISSION_CODES.includes(code), code);
  }
  const role = (name) => SYSTEM_ROLES.find((r) => r.name === name).permissions;
  assert.ok(role("Direccion").includes("kpis.correct_data"));
  assert.ok(role("Supervisor").includes("kpis.manage_incidents"));
  assert.ok(!role("Supervisor").includes("kpis.correct_data"));
  assert.ok(!role("Ventas").includes("kpis.view"));
  assert.ok(role("Calidad").includes("quality.record_errors"));
});

test("menu: dashboard gerencial e incidencias requieren kpis.view", () => {
  assert.equal(buildMenu([]).length, 0);
  const mgmt = buildMenu(["kpis.view"]).flatMap((s) => s.items).map((i) => i.href);
  assert.ok(mgmt.includes("/dashboard-gerencial"));
  assert.ok(mgmt.includes("/incidencias"));
  const quality = buildMenu(["quality.view"]).flatMap((s) => s.items).map((i) => i.href);
  assert.ok(quality.includes("/calidad/errores"));
});
