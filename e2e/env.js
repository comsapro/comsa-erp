import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadDotEnv(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, index).trim()] = value;
  }
  return out;
}

export function e2eEnv() {
  const fromFile = loadDotEnv(".env.e2e");
  const port = process.env.E2E_PORT || fromFile.E2E_PORT || "3100";
  const origin = `http://127.0.0.1:${port}`;
  const databaseUrl =
    process.env.E2E_DATABASE_URL ||
    fromFile.DATABASE_URL ||
    "postgresql://comsa:comsa@127.0.0.1:54329/comsa_e2e?schema=public";
  return {
    DATABASE_URL: databaseUrl,
    AUTH_SECRET:
      process.env.AUTH_SECRET ||
      fromFile.AUTH_SECRET ||
      "e2e-secret-e2e-secret-e2e-secret-32b",
    AUTH_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_ENV: "local",
    E2E_PORT: port,
    E2E_SKIP_DOCKER: process.env.E2E_SKIP_DOCKER || fromFile.E2E_SKIP_DOCKER || "",
  };
}

export function assertE2eDatabase(url) {
  if (!/comsa_e2e|:54329\b/i.test(String(url || ""))) {
    throw new Error(
      `E2E se niega a usar esta DATABASE_URL (no parece comsa_e2e): ${String(url).replace(/:[^:@]+@/, ":***@")}`
    );
  }
}

export function projectRoot() {
  return root;
}
