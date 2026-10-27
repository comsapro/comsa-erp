import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

/** Subir cuando cambie el schema y HMR deba recrear el cliente. */
const PRISMA_CLIENT_EPOCH = 4;

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
  client.__comsaEpoch = PRISMA_CLIENT_EPOCH;
  return client;
}

function isStaleClient(client) {
  // Tras `prisma generate` el proceso HMR puede conservar un PrismaClient viejo
  // sin delegados / relaciones nuevas (p.ej. measurement.instrument).
  return (
    !client ||
    client.__comsaEpoch !== PRISMA_CLIENT_EPOCH ||
    typeof client.purchaseOrder?.findMany !== "function" ||
    typeof client.purchaseReceipt?.findMany !== "function" ||
    typeof client.inventoryStock?.findMany !== "function" ||
    typeof client.productionItemNote?.findMany !== "function" ||
    typeof client.qualityDrawingMeasurement?.findMany !== "function"
  );
}

function getPrisma() {
  const existing = globalForPrisma.prisma;
  if (!isStaleClient(existing)) return existing;

  if (existing) {
    existing.$disconnect().catch(() => {});
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Proxy para que imports cacheados por HMR siempre usen un cliente fresco
 * (evita `prisma.purchaseOrder` undefined tras regenerar el client).
 */
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrisma();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export default prisma;
