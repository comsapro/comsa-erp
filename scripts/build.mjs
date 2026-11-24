import { spawnSync } from "node:child_process";

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

/**
 * Prisma Migrate toma un advisory lock de sesion, que no funciona a traves del
 * pooler de Neon (PgBouncer en modo transaccion) y termina en P1002. Para las
 * migraciones se usa el host directo derivado del mismo DATABASE_URL (sin
 * "-pooler"), asi siempre apunta al mismo branch que la app.
 */
function toDirectUrl(url) {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace("-pooler.", ".");
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return url;
  }
}

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  const migrateUrl = toDirectUrl(databaseUrl);
  const result = spawnSync("npx prisma migrate deploy", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.warn(
    "[build] DATABASE_URL no esta definida. Se omite prisma migrate deploy. " +
      "Agregala en el entorno del hosting para aplicar migraciones y conectar la base."
  );
}

run("npx next build");
