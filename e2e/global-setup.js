import { execSync } from "node:child_process";
import { assertE2eDatabase, e2eEnv, projectRoot } from "./env.js";
import { seedE2e } from "./seed.mjs";

export default async function globalSetup() {
  const env = e2eEnv();
  Object.assign(process.env, env);
  assertE2eDatabase(process.env.DATABASE_URL);

  const root = projectRoot();
  if (!env.E2E_SKIP_DOCKER) {
    try {
      execSync("docker compose -f docker-compose.e2e.yml up -d --wait", {
        cwd: root,
        stdio: "inherit",
      });
    } catch (err) {
      throw new Error(
        "No se pudo levantar Postgres e2e. Arranca Docker Desktop o define E2E_DATABASE_URL y E2E_SKIP_DOCKER=1. " +
          (err.message || "")
      );
    }
  }

  execSync("npx prisma migrate reset --force --skip-seed", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  await seedE2e();
}
