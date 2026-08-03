/**
 * Enriquece stubs "Cliente legado XXX" con nombres reales del dump MySQL.
 * Si el token existe en `clientes`, actualiza commercialName/legalName/etc.
 * Uso: node --env-file=.env scripts/enrich-legacy-client-stubs.js
 */
import { PrismaClient } from "@prisma/client";
import { extractTablesFromDump } from "./mysql-dump-parser.js";

const prisma = new PrismaClient();

const DEFAULT_DUMP =
  process.env.LEGACY_DUMP_PATH ||
  "c:/Users/juanc/Downloads/comsa_2026-07-09.sql/comsa_2026-07-09.sql";

const LEGACY_RE = /^\[legacy:([^\]]+)\]/;

function parseLegacyTag(text) {
  const m = String(text || "").match(LEGACY_RE);
  return m ? m[1] : null;
}

function cleanText(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (["n/a", "na", "fn/a", "null", "-", "."].includes(lower)) return null;
  return s;
}

function mapStatus(raw) {
  return String(raw) === "1" ? "ACTIVE" : "INACTIVE";
}

async function main() {
  const dumpPath = DEFAULT_DUMP;
  console.log(`Leyendo dump: ${dumpPath}`);
  const data = await extractTablesFromDump(dumpPath, ["clientes"]);
  const rows = data.clientes || [];
  console.log(`Clientes en dump: ${rows.length}`);

  const byToken = new Map();
  for (const row of rows) {
    if (row.token) byToken.set(String(row.token).toUpperCase(), row);
  }

  const stubs = await prisma.client.findMany({
    where: {
      deletedAt: null,
      commercialName: { startsWith: "Cliente legado" },
    },
  });
  console.log(`Stubs a revisar: ${stubs.length}`);

  let updated = 0;
  let unmatched = 0;

  for (const stub of stubs) {
    const token = parseLegacyTag(stub.companyProfile);
    if (!token) {
      unmatched += 1;
      continue;
    }
    const row = byToken.get(token.toUpperCase());
    if (!row) {
      unmatched += 1;
      continue;
    }

    const commercialName =
      cleanText(row.nombre) ||
      cleanText(row.empresa) ||
      stub.commercialName;
    const legalName = cleanText(row.empresa);
    const email = cleanText(row.email);
    const phone = cleanText(row.telefono);
    const status = mapStatus(row.status);

    await prisma.client.update({
      where: { id: stub.id },
      data: {
        commercialName,
        legalName,
        email: email || stub.email,
        phone: phone || stub.phone,
        status,
      },
    });
    updated += 1;
  }

  console.log({ updated, unmatched, stubs: stubs.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
