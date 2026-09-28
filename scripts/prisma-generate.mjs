import { spawnSync } from "node:child_process";

// `prisma generate` no se conecta, pero Prisma 6 exige que DATABASE_URL exista
// al validar el schema. En el build del host a veces no esta inyectada.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
}

const result = spawnSync("npx prisma generate", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
