/**
 * Fusiona clientes activos con el mismo commercial_name (case-insensitive).
 * Conserva el que tenga más cotizaciones.
 *
 * Uso: node --env-file=.env scripts/merge-duplicate-clients-by-name.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function reassignClient(fromId, toId) {
  await prisma.quote.updateMany({
    where: { clientId: fromId },
    data: { clientId: toId },
  });
  await prisma.directOrder.updateMany({
    where: { clientId: fromId },
    data: { clientId: toId },
  });
  await prisma.productionOrder.updateMany({
    where: { clientId: fromId },
    data: { clientId: toId },
  });
  const contacts = await prisma.clientContact.findMany({
    where: { clientId: fromId },
  });
  for (const c of contacts) {
    await prisma.clientContact.update({
      where: { id: c.id },
      data: { clientId: toId },
    });
  }
}

async function main() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      commercialName: true,
      email: true,
      phone: true,
      mainContactName: true,
      legalName: true,
      companyProfile: true,
      _count: { select: { quotes: true } },
    },
  });

  const groups = new Map();
  for (const c of clients) {
    const key = String(c.commercialName || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let merged = 0;
  for (const [, items] of groups) {
    if (items.length < 2) continue;
    // Solo fusionar si hay al menos un registro marcado como legado
    // (evita tocar homónimos creados a mano sin tag).
    const hasLegacy = items.some((c) =>
      String(c.companyProfile || "").startsWith("[legacy:")
    );
    if (!hasLegacy) continue;

    // Preferir el cliente "real" del catálogo (más quotes; si empate, el sin stub reciente)
    items.sort((a, b) => b._count.quotes - a._count.quotes);
    const keeper = items[0];

    // Rellenar datos faltantes del keeper con los de los duplicados
    const patch = {};
    for (const dup of items.slice(1)) {
      if (!keeper.email && dup.email) patch.email = dup.email;
      if (!keeper.phone && dup.phone) patch.phone = dup.phone;
      if (!keeper.mainContactName && dup.mainContactName) {
        patch.mainContactName = dup.mainContactName;
      }
      if (!keeper.legalName && dup.legalName) patch.legalName = dup.legalName;
    }
    if (Object.keys(patch).length) {
      await prisma.client.update({ where: { id: keeper.id }, data: patch });
    }

    for (const dup of items.slice(1)) {
      await reassignClient(dup.id, keeper.id);
      await prisma.client.update({
        where: { id: dup.id },
        data: {
          deletedAt: new Date(),
          status: "INACTIVE",
          commercialName: `${dup.commercialName} (fusionado)`,
        },
      });
      merged += 1;
      console.log(
        `merge ${dup.commercialName} (${dup._count.quotes} quotes) -> ${keeper.id}`
      );
    }
  }

  // Stub restante sin datos en anexo
  const orphan = await prisma.client.findFirst({
    where: {
      deletedAt: null,
      commercialName: { startsWith: "Cliente legado" },
    },
    include: {
      quotes: { select: { folio: true }, take: 1 },
    },
  });
  if (orphan) {
    const folio = orphan.quotes[0]?.folio || "s/folio";
    await prisma.client.update({
      where: { id: orphan.id },
      data: {
        commercialName: `Cliente sin identificar (${folio})`,
        mainContactName: null,
      },
    });
    console.log(`orphan renamed using folio ${folio}`);
  }

  const remainingStubs = await prisma.client.count({
    where: {
      deletedAt: null,
      commercialName: { startsWith: "Cliente legado" },
    },
  });
  console.log({ merged, remainingStubs });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
