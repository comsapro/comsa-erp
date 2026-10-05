/**
 * Reasigna cotizaciones migradas al vendedor del sistema anterior.
 * cotizaciones.usr (token) -> usuarios.token -> correo -> User.sellerId.
 * Solo toca cotizaciones con tag [legacy:] en internalObservations.
 *
 * Uso:
 *   node --env-file=.env scripts/reassign-legacy-quote-sellers.mjs
 */
import { PrismaClient } from "@prisma/client";
import { extractTablesFromDump } from "./mysql-dump-parser.js";

const prisma = new PrismaClient();

const DUMP =
  process.env.LEGACY_DUMP_PATH ||
  "c:/Users/juanc/Downloads/comsa_2026-07-09.sql/comsa_2026-07-09.sql";

function cleanEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s.includes("@")) return null;
  return s;
}

function legacyToken(text) {
  const match = String(text || "").match(/^\[legacy:([^\]]+)\]/i);
  return match ? match[1].toUpperCase() : null;
}

async function main() {
  console.log(`Leyendo dump:\n  ${DUMP}`);
  const { cotizaciones = [], usuarios = [] } = await extractTablesFromDump(DUMP, [
    "cotizaciones",
    "usuarios",
  ]);

  const emailByUserToken = new Map();
  for (const user of usuarios) {
    const email = cleanEmail(user.usr);
    const token = String(user.token || "").trim().toUpperCase();
    if (token && email) emailByUserToken.set(token, email);
  }

  const emailByQuoteToken = new Map();
  for (const row of cotizaciones) {
    const quoteToken = String(row.token || "").trim().toUpperCase();
    const userToken = String(row.usr || "").trim().toUpperCase();
    const email = emailByUserToken.get(userToken);
    if (quoteToken && email) emailByQuoteToken.set(quoteToken, email);
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(
    users.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user.id])
  );

  const quotes = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      internalObservations: { startsWith: "[legacy:" },
    },
    select: { id: true, folio: true, sellerId: true, internalObservations: true },
  });

  let updated = 0;
  let already = 0;
  let missing = 0;
  const pending = [];

  for (const quote of quotes) {
    const token = legacyToken(quote.internalObservations);
    const email = token ? emailByQuoteToken.get(token) : null;
    const sellerId = email ? userByEmail.get(email) : null;
    if (!sellerId) {
      missing += 1;
      if (pending.length < 25) {
        pending.push(`${quote.folio} · ${email || token || "sin token"}`);
      }
      continue;
    }
    if (quote.sellerId === sellerId) {
      already += 1;
      continue;
    }
    await prisma.quote.update({
      where: { id: quote.id },
      data: { sellerId },
    });
    updated += 1;
  }

  console.log(
    `Cotizaciones legado: ${quotes.length}. Reasignadas: ${updated}. Ya correctas: ${already}. Sin usuario: ${missing}.`
  );
  if (pending.length) {
    console.log("Sin reasignar (muestra):");
    for (const line of pending) console.log(`  ${line}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
