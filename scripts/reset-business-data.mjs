/**
 * Vacia los datos de negocio de una base, conservando usuarios, control de
 * acceso y configuracion del sistema. Pensado para preparar un branch de Neon
 * antes de recargar el dump legado (npm run db:seed:legacy).
 *
 * Uso (dry-run por defecto, solo muestra conteos):
 *   TARGET_DATABASE_URL="postgresql://..." node scripts/reset-business-data.mjs
 *   TARGET_DATABASE_URL="postgresql://..." node scripts/reset-business-data.mjs --execute
 *
 * Candados:
 *   - Solo usa TARGET_DATABASE_URL (nunca DATABASE_URL).
 *   - Se niega si el host esta en BLOCKED_HOSTS (separados por coma).
 *   - TRUNCATE sin CASCADE: si alguna tabla conservada referencia una tabla a
 *     vaciar, Postgres aborta todo y no se borra nada.
 */

import { PrismaClient } from "@prisma/client";

const KEEP = new Set([
  "_prisma_migrations",
  // Usuarios y control de acceso
  "users",
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "teams",
  "team_members",
  "team_roles",
  // Configuracion del sistema (sembrada por migraciones/seed o requerida por cotizaciones)
  "kpi_catalog_entries",
  "kpi_settings",
  "production_settings",
  "holidays",
  "issuing_companies",
]);

const url = process.env.TARGET_DATABASE_URL;
const execute = process.argv.includes("--execute");

if (!url) {
  console.error("Falta TARGET_DATABASE_URL.");
  process.exit(1);
}

const host = new URL(url).hostname;
const blocked = (process.env.BLOCKED_HOSTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (blocked.some((b) => host.includes(b))) {
  console.error(`Host bloqueado: ${host}`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const all = rows.map((r) => r.tablename);
  const toWipe = all.filter((t) => !KEEP.has(t));
  const kept = all.filter((t) => KEEP.has(t));

  console.log(`Host: ${host}`);
  console.log(`\nSe conservan (${kept.length}):`);
  for (const t of kept) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`  ${t}: ${n}`);
  }
  console.log(`\nSe vacian (${toWipe.length}):`);
  let total = 0;
  for (const t of toWipe) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`);
    total += n;
    if (n) console.log(`  ${t}: ${n}`);
  }
  console.log(`  (total ${total} filas; tablas vacias omitidas)`);

  if (!execute) {
    console.log("\nDry-run: no se borro nada. Agrega --execute para vaciar.");
  } else {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${toWipe.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`
    );
    console.log("\nTablas vaciadas.");
  }
} finally {
  await prisma.$disconnect();
}
