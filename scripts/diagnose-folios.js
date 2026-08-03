import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const seq = await p.folioSequence.findMany({
    where: { scope: "QUOTE" },
    orderBy: { yearMonth: "desc" },
    take: 6,
  });
  console.log("sequences", seq);

  for (const s of seq) {
    const prefix = `${s.yearMonth}-`;
    const quotes = await p.quote.findMany({
      where: { folio: { startsWith: prefix } },
      select: { folio: true },
    });
    let maxN = 0;
    for (const q of quotes) {
      const m = String(q.folio).match(new RegExp(`^${s.yearMonth}-(\\d+)-`));
      if (m) maxN = Math.max(maxN, Number(m[1]));
    }
    console.log({
      yearMonth: s.yearMonth,
      lastValue: s.lastValue,
      maxInQuotes: maxN,
      behind: maxN > s.lastValue,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
