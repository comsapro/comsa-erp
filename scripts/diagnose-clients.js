import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const stubs = await p.client.count({
    where: { deletedAt: null, commercialName: { startsWith: "Cliente legado" } },
  });
  const tagged = await p.client.count({
    where: { deletedAt: null, companyProfile: { startsWith: "[legacy:" } },
  });
  const total = await p.client.count({ where: { deletedAt: null } });
  const realTagged = await p.client.count({
    where: {
      deletedAt: null,
      companyProfile: { startsWith: "[legacy:" },
      NOT: { commercialName: { startsWith: "Cliente legado" } },
    },
  });
  console.log({ stubs, tagged, total, realTagged });

  const stubSamples = await p.client.findMany({
    where: { deletedAt: null, commercialName: { startsWith: "Cliente legado" } },
    take: 5,
    select: { id: true, commercialName: true, companyProfile: true },
  });
  console.log("stub samples", stubSamples);

  const realSamples = await p.client.findMany({
    where: {
      deletedAt: null,
      NOT: { commercialName: { startsWith: "Cliente legado" } },
    },
    take: 5,
    select: { id: true, commercialName: true, companyProfile: true },
  });
  console.log("real samples", realSamples);

  // Check if stub tokens overlap with real tagged clients
  const stubTokens = await p.client.findMany({
    where: { deletedAt: null, commercialName: { startsWith: "Cliente legado" } },
    select: { id: true, companyProfile: true },
  });
  let matchable = 0;
  for (const s of stubTokens) {
    const tag = s.companyProfile;
    if (!tag?.startsWith("[legacy:")) continue;
    const real = await p.client.findFirst({
      where: {
        deletedAt: null,
        companyProfile: tag,
        NOT: { commercialName: { startsWith: "Cliente legado" } },
      },
      select: { id: true },
    });
    if (real) matchable += 1;
  }
  console.log({ stubsWithMatchingReal: matchable, stubTotalChecked: stubTokens.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
