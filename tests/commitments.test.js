import test from "node:test";
import assert from "node:assert/strict";
import {
  commitmentAbilities,
  isCommitmentOverdue,
  nextStatusFromParticipants,
  todayMx,
} from "../domains/commitments/constants.js";
import { commitmentSchema, commitmentActionSchema } from "../domains/commitments/schemas.js";
import { salesProgress } from "../domains/kpis/calculations.js";

const base = {
  status: "OPEN",
  createdBy: "creator",
  dueDate: "2026-11-20",
  participants: [
    { userId: "a", completedAt: null },
    { userId: "b", completedAt: null },
  ],
};

test("pasa a Por aprobar solo cuando todos terminan", () => {
  assert.equal(nextStatusFromParticipants("OPEN", [{ completedAt: new Date() }, { completedAt: null }]), "OPEN");
  assert.equal(nextStatusFromParticipants("OPEN", [{ completedAt: new Date() }, { completedAt: new Date() }]), "IN_REVIEW");
  assert.equal(nextStatusFromParticipants("IN_REVIEW", [{ completedAt: null }]), "OPEN");
  assert.equal(nextStatusFromParticipants("CLOSED", [{ completedAt: null }]), "CLOSED");
});

test("solo el creador o un admin aprueban, y solo en revision", () => {
  const review = { ...base, status: "IN_REVIEW" };
  assert.equal(commitmentAbilities(review, { userId: "creator" }).canApprove, true);
  assert.equal(commitmentAbilities(review, { userId: "a" }).canApprove, false);
  assert.equal(commitmentAbilities(review, { userId: "x", isAdmin: true }).canApprove, true);
  assert.equal(commitmentAbilities(base, { userId: "creator" }).canApprove, false);
});

test("involucrado marca su parte y no ve compromisos ajenos", () => {
  assert.equal(commitmentAbilities(base, { userId: "a" }).canMarkDone, true);
  assert.equal(commitmentAbilities(base, { userId: "creator" }).canMarkDone, false);
  assert.equal(commitmentAbilities(base, { userId: "z" }).canView, false);
  assert.equal(commitmentAbilities(base, { userId: "z", canViewAll: true }).canView, true);
});

test("vencido usa la fecha de Mexico y no aplica a cerrados", () => {
  assert.equal(isCommitmentOverdue(base, "2026-11-21"), true);
  assert.equal(isCommitmentOverdue(base, "2026-11-20"), false);
  assert.equal(isCommitmentOverdue({ ...base, status: "CLOSED" }, "2026-12-01"), false);
  assert.equal(todayMx(new Date("2026-11-26T03:00:00Z")), "2026-11-25");
});

test("validaciones del compromiso y de rechazo", () => {
  const bad = commitmentSchema.safeParse({ title: "X", startDate: "2026-11-10", dueDate: "2026-11-01", participantIds: [] });
  assert.equal(bad.success, false);
  assert.equal(commitmentActionSchema.safeParse({ action: "reject" }).success, false);
  assert.equal(commitmentActionSchema.safeParse({ action: "reject", body: "Falta evidencia" }).success, true);
});

test("factura acreditada a un equipo suma a la meta del equipo", () => {
  const targets = [{ key: "t1", label: "Equipo", memberIds: ["jaime"], teamIds: ["team1"], goalWithTax: 1000 }];
  const invoices = [
    { sellerId: "otro", teamId: "team1", netAmount: 300 },
    { sellerId: "jaime", teamId: null, netAmount: 200 },
    { sellerId: "otro", teamId: null, netAmount: 50 },
  ];
  const { rows } = salesProgress(targets, invoices, 16);
  assert.equal(rows[0].billedWithTax, 500);
  assert.equal(rows.find((r) => r.key === "__unassigned__").billedWithTax, 50);
});

test("historico: crecimiento anual, comparacion del anio en curso y meses", async () => {
  const { buildHistory, growthPct, rankWithShare } = await import("../domains/sales/history-calc.js");
  assert.equal(growthPct(110, 100), 10);
  assert.equal(growthPct(5, 0), null);
  const rows = [
    { ym: "2025-01", total: 100, count: 1 },
    { ym: "2025-02", total: 100, count: 1 },
    { ym: "2025-12", total: 800, count: 2 },
    { ym: "2026-01", total: 150, count: 1 },
    { ym: "2026-02", total: 50, count: 1 },
  ];
  const { years } = buildHistory(rows, { today: new Date("2026-02-15T12:00:00Z") });
  const y25 = years.find((y) => y.year === 2025);
  const y26 = years.find((y) => y.year === 2026);
  assert.equal(y25.total, 1000);
  assert.equal(y26.partial, true);
  assert.equal(y26.growthPct, null);
  assert.equal(y26.ytdGrowthPct, 0); // ene-feb 200 vs 200
  assert.equal(y26.months[0].yoyPct, 50);
  assert.equal(y26.months[0].momPct, -81.2); // vs dic 2025 (150 vs 800)
  const rank = rankWithShare([{ name: "A", total: 75, count: 1 }, { name: "B", total: 25, count: 1 }], [{ name: "A", total: 50 }]);
  assert.deepEqual(rank.map((r) => [r.name, r.sharePct, r.growthPct]), [["A", 75, 50], ["B", 25, null]]);
});
