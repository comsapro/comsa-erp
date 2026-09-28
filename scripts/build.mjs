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

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  run("npx prisma migrate deploy");
} else {
  console.warn(
    "[build] DATABASE_URL no esta definida. Se omite prisma migrate deploy. " +
      "Agregala en el entorno del hosting para aplicar migraciones y conectar la base."
  );
}

run("npx next build");
