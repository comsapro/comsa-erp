import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

function isStaleClient(client) {
  // Tras `prisma generate` el proceso HMR puede conservar un PrismaClient viejo
  // sin delegados de Etapa 3 (OC / recepciones / inventario).
  return (
    !client ||
    typeof client.purchaseOrder?.findMany !== "function" ||
    typeof client.purchaseReceipt?.findMany !== "function" ||
    typeof client.inventoryStock?.findMany !== "function" ||
    typeof client.productionItemNote?.findMany !== "function"
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
