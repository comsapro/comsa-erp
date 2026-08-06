/**
 * Enriquece stubs "Cliente legado XXX":
 * 1) Con datos de tabla `clientes` del dump (si el token existe).
 * 2) Si no, infiere empresa/contacto desde anexos de cotizaciones.
 * 3) Consolida stubs duplicados (mismo dominio corporativo o mismo email).
 *
 * Uso: node --env-file=.env scripts/enrich-legacy-client-stubs.js
 */
import { PrismaClient } from "@prisma/client";
import { extractTablesFromDump } from "./mysql-dump-parser.js";
import { phpUnserialize } from "./php-unserialize.js";

const prisma = new PrismaClient();

const DEFAULT_DUMP =
  process.env.LEGACY_DUMP_PATH ||
  "c:/Users/juanc/Downloads/comsa_2026-07-09.sql/comsa_2026-07-09.sql";

const LEGACY_RE = /^\[legacy:([^\]]+)\]/;

const GENERIC_EMAIL = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.mx",
  "live.com",
  "icloud.com",
  "protonmail.com",
]);

/** Dominios conocidos → nombre comercial canónico */
const DOMAIN_COMPANY = {
  "hennigesautomotive.com": "HENNIGES",
  "toyota-boshoku.com": "TOYOTA BOSHOKU",
  "serviciosptoin.com": "SERVICIOS PTOIN",
  "biopappel.com": "BIOPAPPEL",
  "bachoco.net": "BACHOCO",
  "grupodiuren.com": "GRUPO DIUREN",
  "edrsilver.com": "EDR SILVER",
  "jibe.com.mx": "JIBE",
  "comsapro.com": "COMSA PRO",
  "coupa.com": "COUPA",
};

function parseLegacyTag(text) {
  const m = String(text || "").match(LEGACY_RE);
  return m ? m[1] : null;
}

function cleanText(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/^"+|"+$/g, "").trim();
  const lower = s.toLowerCase();
  if (
    ["n/a", "na", "fn/a", "null", "-", ".", "-*", "n/a", "0"].includes(lower)
  ) {
    return null;
  }
  return s;
}

function cleanEmail(value) {
  const s = cleanText(value);
  if (!s || !s.includes("@")) return null;
  return s.toLowerCase();
}

function emailDomain(email) {
  const e = cleanEmail(email);
  if (!e) return null;
  return e.split("@")[1] || null;
}

function companyFromDomain(domain) {
  if (!domain || GENERIC_EMAIL.has(domain)) return null;
  if (DOMAIN_COMPANY[domain]) return DOMAIN_COMPANY[domain];
  const base = domain
    .replace(/\.(com\.mx|com|net|org|mx)$/i, "")
    .split(".")[0];
  return base.replace(/[-_]/g, " ").toUpperCase();
}

function mapStatus(raw) {
  return String(raw) === "1" ? "ACTIVE" : "INACTIVE";
}

function pickMode(arr) {
  const counts = new Map();
  for (const v of arr) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function groupKey({ domain, email, contact, token }) {
  if (domain && !GENERIC_EMAIL.has(domain)) return `domain:${domain}`;
  if (email) return `email:${email}`;
  if (contact) return `contact:${contact.toLowerCase()}`;
  return `token:${token}`;
}

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
  // Contactos: evitar duplicar emails; mover los que se pueda
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
  const dumpPath = DEFAULT_DUMP;
  console.log(`Leyendo dump: ${dumpPath}`);
  const data = await extractTablesFromDump(dumpPath, [
    "clientes",
    "cotizaciones",
  ]);
  const clientRows = data.clientes || [];
  const quotes = data.cotizaciones || [];
  console.log(
    `Dump: ${clientRows.length} clientes, ${quotes.length} cotizaciones`
  );

  const byToken = new Map();
  for (const row of clientRows) {
    if (row.token) byToken.set(String(row.token).toUpperCase(), row);
  }

  const quotesByClientToken = new Map();
  for (const q of quotes) {
    const t = String(q.cliente || "").toUpperCase();
    if (!t) continue;
    if (!quotesByClientToken.has(t)) quotesByClientToken.set(t, []);
    quotesByClientToken.get(t).push(q);
  }

  const stubs = await prisma.client.findMany({
    where: {
      deletedAt: null,
      commercialName: { startsWith: "Cliente legado" },
    },
  });
  console.log(`Stubs a revisar: ${stubs.length}`);

  const enriched = [];
  let fromDump = 0;
  let fromAnexo = 0;
  let unmatched = 0;

  for (const stub of stubs) {
    const token = parseLegacyTag(stub.companyProfile);
    if (!token) {
      unmatched += 1;
      enriched.push({
        stub,
        token: null,
        commercialName: stub.commercialName,
        legalName: stub.legalName,
        email: stub.email,
        phone: stub.phone,
        mainContactName: stub.mainContactName,
        status: stub.status,
        quoteCount: 0,
        group: `orphan:${stub.id}`,
      });
      continue;
    }

    const dumpRow = byToken.get(token.toUpperCase());
    if (dumpRow) {
      fromDump += 1;
      const commercialName =
        cleanText(dumpRow.nombre) ||
        cleanText(dumpRow.empresa) ||
        stub.commercialName;
      enriched.push({
        stub,
        token,
        commercialName,
        legalName: cleanText(dumpRow.empresa),
        email: cleanEmail(dumpRow.email) || stub.email,
        phone: cleanText(dumpRow.telefono) || stub.phone,
        mainContactName: stub.mainContactName,
        status: mapStatus(dumpRow.status),
        quoteCount: (quotesByClientToken.get(token.toUpperCase()) || []).length,
        group: groupKey({
          domain: emailDomain(dumpRow.email),
          email: cleanEmail(dumpRow.email),
          contact: commercialName,
          token,
        }),
      });
      continue;
    }

    const related = quotesByClientToken.get(token.toUpperCase()) || [];
    const contacts = [];
    const phones = [];
    const emails = [];
    for (const q of related) {
      const anexo = phpUnserialize(q.anexo) || {};
      const c = cleanText(anexo.clienteResponsable);
      const p = cleanText(anexo.clienteTelefono);
      const e = cleanEmail(anexo.clienteEmail);
      if (c) contacts.push(c);
      if (p) phones.push(p);
      if (e) emails.push(e);
    }

    const contact = pickMode(contacts);
    const phone = pickMode(phones);
    const email = pickMode(emails);
    const domain = emailDomain(email);
    const company = companyFromDomain(domain);
    const commercialName = company || contact || stub.commercialName;

    if (commercialName === stub.commercialName) unmatched += 1;
    else fromAnexo += 1;

    enriched.push({
      stub,
      token,
      commercialName,
      legalName: company || null,
      email: email || stub.email,
      phone: phone || stub.phone,
      mainContactName: contact || stub.mainContactName,
      status: stub.status,
      quoteCount: related.length,
      group: groupKey({ domain, email, contact, token }),
    });
  }

  // Consolidar por grupo
  const groups = new Map();
  for (const item of enriched) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  let updated = 0;
  let merged = 0;
  let softDeleted = 0;

  for (const [, items] of groups) {
    items.sort((a, b) => b.quoteCount - a.quoteCount);
    const keeper = items[0];
    const keeperId = keeper.stub.id;

    await prisma.client.update({
      where: { id: keeperId },
      data: {
        commercialName: keeper.commercialName,
        legalName: keeper.legalName ?? keeper.stub.legalName,
        email: keeper.email || null,
        phone: keeper.phone || null,
        mainContactName: keeper.mainContactName || null,
        status: keeper.status,
      },
    });
    updated += 1;

    for (const dup of items.slice(1)) {
      await reassignClient(dup.stub.id, keeperId);
      await prisma.client.update({
        where: { id: dup.stub.id },
        data: {
          deletedAt: new Date(),
          status: "INACTIVE",
          commercialName: `${dup.commercialName} (fusionado)`,
        },
      });
      merged += 1;
      softDeleted += 1;
    }
  }

  const remaining = await prisma.client.count({
    where: {
      deletedAt: null,
      commercialName: { startsWith: "Cliente legado" },
    },
  });

  console.log({
    fromDump,
    fromAnexo,
    unmatched,
    updated,
    merged,
    softDeleted,
    remainingStubs: remaining,
    groups: groups.size,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
