import test from "node:test";
import assert from "node:assert/strict";
import {
  staleCutoffDate,
  rejectStaleQuotes,
  STALE_REJECTION_REASON,
} from "../domains/quotes/stale.js";

const iso = (d) => d.toISOString().slice(0, 10);

test("corte = hoy en Mexico menos 3 meses", () => {
  assert.equal(iso(staleCutoffDate(new Date("2026-11-25T18:00:00Z"))), "2026-08-25");
});

test("usa la fecha de Mexico, no la UTC", () => {
  // 03:00 UTC del 26 = 21:00 del 25 en Mexico
  assert.equal(iso(staleCutoffDate(new Date("2026-11-26T03:00:00Z"))), "2026-08-25");
});

test("ajusta fin de mes y cambio de anio", () => {
  assert.equal(iso(staleCutoffDate(new Date("2026-05-31T18:00:00Z"))), "2026-02-28");
  assert.equal(iso(staleCutoffDate(new Date("2027-01-15T18:00:00Z"))), "2026-10-15");
});

function fakePrisma(quotes) {
  const audits = [];
  const tx = {
    quote: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const q of quotes) {
          if (where.id.in.includes(q.id) && where.status.in.includes(q.status)) {
            Object.assign(q, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    auditLog: { createMany: async ({ data }) => audits.push(...data) },
  };
  return {
    audits,
    quote: {
      findMany: async ({ where }) =>
        quotes.filter(
          (q) => where.status.in.includes(q.status) && q.elaborationDate < where.elaborationDate.lt
        ),
    },
    $transaction: (fn) => fn(tx),
  };
}

test("rechaza borradores y en revision viejos con la leyenda", async () => {
  const quotes = [
    { id: "a", folio: "1", status: "DRAFT", elaborationDate: new Date("2026-08-01") },
    { id: "b", folio: "2", status: "PENDING_APPROVAL", elaborationDate: new Date("2026-08-24") },
    { id: "c", folio: "3", status: "DRAFT", elaborationDate: new Date("2026-08-25") },
    { id: "d", folio: "4", status: "APPROVED", elaborationDate: new Date("2026-01-01") },
  ];
  const prisma = fakePrisma(quotes);
  const r = await rejectStaleQuotes(prisma, { now: new Date("2026-11-25T18:00:00Z") });
  assert.equal(r.rejected, 2);
  assert.deepEqual(quotes.map((q) => q.status), ["REJECTED", "REJECTED", "DRAFT", "APPROVED"]);
  assert.equal(quotes[0].rejectionReason, STALE_REJECTION_REASON);
  assert.equal(prisma.audits.length, 2);
});

test("dryRun no modifica", async () => {
  const quotes = [{ id: "a", folio: "1", status: "DRAFT", elaborationDate: new Date("2026-01-01") }];
  const r = await rejectStaleQuotes(fakePrisma(quotes), { now: new Date("2026-11-25T18:00:00Z"), dryRun: true });
  assert.equal(r.candidates, 1);
  assert.equal(r.rejected, 0);
  assert.equal(quotes[0].status, "DRAFT");
});
