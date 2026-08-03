/**
 * Sincroniza folio_sequences con el máximo numérico real en documentos.
 * Uso: node --env-file=.env scripts/sync-folio-sequences.js
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const SCOPES = [
  { scope: "QUOTE", model: "quote", field: "folio" },
  { scope: "PRODUCTION", model: "productionOrder", field: "folio" },
  { scope: "DIRECT_ORDER", model: "directOrder", field: "folio" },
  { scope: "PURCHASE_ORDER", model: "purchaseOrder", field: "folio" },
  { scope: "PURCHASE_RECEIPT", model: "purchaseReceipt", field: "folio" },
];

function parseYmAndSeq(folio) {
  const m = String(folio || "").match(/^(\d{4})-(\d+)-/);
  if (!m) return null;
  return { yearMonth: m[1], seq: Number(m[2]) };
}

async function syncScope(scope, model, field) {
  const hasDeletedAt = !["productionOrder", "productionItem", "purchaseReceipt"].includes(
    model
  );
  const rows = await p[model].findMany({
    where: hasDeletedAt ? { deletedAt: null } : undefined,
    select: { [field]: true },
  });
  const maxByYm = new Map();
  for (const row of rows) {
    const parsed = parseYmAndSeq(row[field]);
    if (!parsed) continue;
    const prev = maxByYm.get(parsed.yearMonth) || 0;
    if (parsed.seq > prev) maxByYm.set(parsed.yearMonth, parsed.seq);
  }

  let updated = 0;
  for (const [yearMonth, maxSeq] of maxByYm.entries()) {
    const existing = await p.folioSequence.findUnique({
      where: { scope_yearMonth: { scope, yearMonth } },
    });
    if (!existing) {
      await p.folioSequence.create({
        data: { scope, yearMonth, lastValue: maxSeq },
      });
      updated += 1;
      console.log(`  ${scope} ${yearMonth}: created lastValue=${maxSeq}`);
    } else if (existing.lastValue < maxSeq) {
      await p.folioSequence.update({
        where: { id: existing.id },
        data: { lastValue: maxSeq },
      });
      updated += 1;
      console.log(
        `  ${scope} ${yearMonth}: ${existing.lastValue} -> ${maxSeq}`
      );
    }
  }
  return updated;
}

async function main() {
  let total = 0;
  for (const s of SCOPES) {
    console.log(`Sync ${s.scope}...`);
    total += await syncScope(s.scope, s.model, s.field);
  }
  console.log(`Done. Periods updated: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
