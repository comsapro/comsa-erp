/**
 * Importa catálogos y existencias desde el dump MySQL legado (comsa_YYYY-MM-DD.sql)
 * hacia el esquema PostgreSQL/Prisma actual.
 *
 * Uso:
 *   node --env-file=.env prisma/import-legacy.js
 *   LEGACY_DUMP_PATH="C:/ruta/dump.sql" npm run db:seed:legacy
 *
 * Idempotente: reutiliza codes/sku/marcadores [legacy:TOKEN] en re-ejecuciones.
 * Importa catálogos, existencias, cotizaciones y producción.
 */

import { randomUUID } from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { extractTablesFromDump } from "../scripts/mysql-dump-parser.js";
import { applyStockChange } from "../domains/inventory/stock-math.js";
import { importQuotesAndProduction } from "./import-legacy-quotes.js";

/** Folio local (evita importar lib/folios que usa `server-only`). */
async function generateFolio(tx, scope, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${yy}${mm}`;

  const existing = await tx.folioSequence.findUnique({
    where: { scope_yearMonth: { scope, yearMonth } },
  });

  let nextValue;
  if (existing) {
    const updated = await tx.folioSequence.update({
      where: { id: existing.id },
      data: { lastValue: { increment: 1 } },
    });
    nextValue = updated.lastValue;
  } else {
    const created = await tx.folioSequence.create({
      data: { scope, yearMonth, lastValue: 1 },
    });
    nextValue = created.lastValue;
  }

  return `${yearMonth}-${nextValue}-A`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Long-running bulk import against Neon pooler
  log: ["warn", "error"],
});

const DEFAULT_DUMP =
  process.env.LEGACY_DUMP_PATH ||
  "c:/Users/juanc/Downloads/comsa_2026-07-09.sql/comsa_2026-07-09.sql";

const TABLES = [
  "almacenes",
  "almacenesExistencias",
  "clientes",
  "proveedores",
  "items",
  "itemsCategorias",
  "comsaProcesos",
  "comsaInstalaciones",
  "cotizaciones",
  "cotizacionesPartidas",
  "cotizacionesItems",
  "produccion",
];

const LEGACY_RE = /^\[legacy:([^\]]+)\]/;

function cleanText(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (["n/a", "na", "fn/a", "null", "-", "."].includes(lower)) return null;
  return s;
}

function cleanEmail(value) {
  const s = cleanText(value);
  if (!s || !s.includes("@")) return null;
  return s.toLowerCase();
}

function cleanPhone(value) {
  const s = cleanText(value);
  if (!s) return null;
  return s.slice(0, 40);
}

function mapStatus(status) {
  return String(status) === "1" ? "ACTIVE" : "INACTIVE";
}

function mapItemType(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "hye") return "TOOL";
  if (t === "mp" || t === "mat") return "RAW_MATERIAL";
  if (t === "cons") return "CONSUMABLE";
  if (t === "eq") return "EQUIPMENT";
  if (t === "srv" || t === "ser") return "SERVICE";
  if (t === "pc" || t === "prod") return "PRODUCT";
  return "PRODUCT";
}

function mapProcessUnit(unidad) {
  const u = String(unidad || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (u.includes("hora")) return "HOUR";
  if (u.includes("servicio")) return "SERVICE";
  if (u.includes("metro")) return "METER";
  if (u.includes("kg") || u.includes("kilo")) return "KILOGRAM";
  if (u.includes("lote")) return "LOT";
  if (u.includes("pieza") || u.includes("pza") || u.includes("corte")) {
    return "PIECE";
  }
  return "HOUR";
}

function legacyTag(token) {
  return `[legacy:${token}]`;
}

function parseLegacyTag(text) {
  if (!text) return null;
  const m = String(text).match(LEGACY_RE);
  return m ? m[1] : null;
}

function withLegacyTag(token, rest) {
  const tag = legacyTag(token);
  const body = cleanText(rest);
  return body ? `${tag} ${body}` : tag;
}

function joinAddress(parts) {
  return parts.map(cleanText).filter(Boolean).join(", ") || null;
}

function toDecimalQty(value) {
  const n = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1000) / 1000;
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

async function resolveActorUserId() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@comsa.com").toLowerCase();
  const admin = await prisma.user.findUnique({ where: { email } });
  if (admin) return admin.id;

  const any = await prisma.user.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!any) {
    throw new Error(
      "No hay usuarios en la BD. Ejecuta primero `npm run db:seed` con SEED_ADMIN_PASSWORD."
    );
  }
  return any.id;
}

async function postInitialBalance(tx, { warehouseId, itemId, quantity, referenceId, createdBy, notes }) {
  const stockId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO inventory_stock (id, warehouse_id, item_id, quantity, reserved_quantity, available_quantity, updated_at)
    VALUES (${stockId}, ${warehouseId}, ${itemId}, 0, 0, 0, NOW())
    ON CONFLICT (warehouse_id, item_id) DO NOTHING
  `;

  const locked = await tx.$queryRaw`
    SELECT id, quantity, reserved_quantity, available_quantity
    FROM inventory_stock
    WHERE warehouse_id = ${warehouseId} AND item_id = ${itemId}
    FOR UPDATE
  `;
  const row = locked[0];
  const next = applyStockChange(
    { quantity: row.quantity, reservedQuantity: row.reserved_quantity },
    "ENTRY",
    quantity
  );

  await tx.inventoryStock.update({
    where: { id: row.id },
    data: {
      quantity: new Prisma.Decimal(next.quantity),
      reservedQuantity: new Prisma.Decimal(next.reservedQuantity),
      availableQuantity: new Prisma.Decimal(next.availableQuantity),
    },
  });

  const folio = await generateFolio(tx, "INVENTORY_MOVEMENT", new Date());
  await tx.inventoryMovement.create({
    data: {
      folio,
      warehouseId,
      itemId,
      movementType: "ENTRY",
      quantity: new Prisma.Decimal(quantity),
      referenceType: "INITIAL_BALANCE",
      referenceId,
      reason: "Importación saldo inicial (sistema legado)",
      notes,
      movementDate: new Date(),
      createdBy,
    },
  });
}

async function importWarehouses(rows, actorId) {
  const map = new Map();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const token = row.token;
    const code = `ALM-${row.id}`;
    const name = cleanText(row.nombre) || `Almacén ${row.id}`;
    const status = mapStatus(row.status);
    const description = withLegacyTag(token, null);

    const existing = await prisma.warehouse.findUnique({ where: { code } });
    if (existing) {
      const wh = await prisma.warehouse.update({
        where: { code },
        data: {
          name,
          description,
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : existing.deletedAt,
        },
      });
      map.set(token, wh.id);
      updated += 1;
    } else {
      const wh = await prisma.warehouse.create({
        data: {
          code,
          name,
          description,
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      map.set(token, wh.id);
      created += 1;
    }
  }

  console.log(`  Almacenes: ${created} nuevos, ${updated} actualizados`);
  return map;
}

async function importCategories(rows, actorId) {
  const map = new Map();
  let created = 0;
  let updated = 0;

  const existing = await prisma.productCategory.findMany({
    where: { description: { startsWith: "[legacy:" } },
  });
  const byToken = new Map(
    existing
      .map((c) => [parseLegacyTag(c.description), c])
      .filter(([t]) => t)
  );

  for (const row of rows) {
    const token = row.token;
    const name = cleanText(row.nombre) || `Categoría ${row.id}`;
    const status = mapStatus(row.status);
    const description = withLegacyTag(token, row.nombreUrl);

    const prev = byToken.get(token);
    if (prev) {
      const cat = await prisma.productCategory.update({
        where: { id: prev.id },
        data: {
          name,
          description,
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : prev.deletedAt,
        },
      });
      map.set(token, cat.id);
      updated += 1;
    } else {
      const cat = await prisma.productCategory.create({
        data: {
          name,
          description,
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      map.set(token, cat.id);
      created += 1;
    }
  }

  console.log(`  Categorías: ${created} nuevas, ${updated} actualizadas`);
  return map;
}

async function importItems(rows, categoryMap, actorId) {
  const map = new Map();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const token = row.token;
    const sku = cleanText(row.sku) || `LEGACY-${row.id}`;
    const name = cleanText(row.nombre) || sku;
    const description = withLegacyTag(
      token,
      [cleanText(row.descripcion), cleanText(row.codigoBarras) ? `CB:${row.codigoBarras}` : null]
        .filter(Boolean)
        .join(" | ")
    );
    const status = mapStatus(row.status);
    const itemType = mapItemType(row.tipo);
    const categoryId = row.categoria ? categoryMap.get(row.categoria) || null : null;
    const unitOfMeasure = cleanText(row.satUnidadClave);

    try {
      const existing = await prisma.item.findUnique({ where: { sku } });
      if (existing) {
        const item = await prisma.item.update({
          where: { sku },
          data: {
            name,
            description,
            itemType,
            categoryId,
            unitOfMeasure,
            status,
            isInventoryControlled: true,
            updatedBy: actorId,
            deletedAt: status === "ACTIVE" ? null : existing.deletedAt,
          },
        });
        map.set(token, item.id);
        updated += 1;
      } else {
        const item = await prisma.item.create({
          data: {
            sku,
            name,
            description,
            itemType,
            categoryId,
            unitOfMeasure,
            status,
            isInventoryControlled: true,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        map.set(token, item.id);
        created += 1;
      }
    } catch (err) {
      skipped += 1;
      console.warn(`  Item omitido id=${row.id} sku=${sku}: ${err.message}`);
    }
  }

  console.log(
    `  Items: ${created} nuevos, ${updated} actualizados` +
      (skipped ? `, ${skipped} omitidos` : "")
  );
  return map;
}

async function importClients(rows, actorId) {
  let created = 0;
  let updated = 0;

  const existing = await prisma.client.findMany({
    where: { companyProfile: { startsWith: "[legacy:" } },
  });
  const byToken = new Map(
    existing
      .map((c) => [parseLegacyTag(c.companyProfile), c])
      .filter(([t]) => t)
  );

  for (const row of rows) {
    const token = row.token;
    const commercialName =
      cleanText(row.nombre) || cleanText(row.empresa) || `Cliente ${row.id}`;
    const legalName = cleanText(row.empresa);
    const email = cleanEmail(row.email);
    const phone = cleanPhone(row.telefono);
    const status = mapStatus(row.status);
    const companyProfile = withLegacyTag(
      token,
      [cleanText(row.tipo), cleanText(row.clave) ? `clave:${row.clave}` : null]
        .filter(Boolean)
        .join(" | ")
    );

    const prev = byToken.get(token);
    if (prev) {
      await prisma.client.update({
        where: { id: prev.id },
        data: {
          commercialName,
          legalName,
          email,
          phone,
          companyProfile,
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : prev.deletedAt,
        },
      });
      updated += 1;
    } else {
      await prisma.client.create({
        data: {
          commercialName,
          legalName,
          email,
          phone,
          companyProfile,
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      created += 1;
    }
  }

  console.log(`  Clientes: ${created} nuevos, ${updated} actualizados`);
}

async function importSuppliers(rows, actorId) {
  let created = 0;
  let updated = 0;

  const existing = await prisma.supplier.findMany({
    where: { productsServices: { startsWith: "[legacy:" } },
  });
  const byToken = new Map(
    existing
      .map((s) => [parseLegacyTag(s.productsServices), s])
      .filter(([t]) => t)
  );

  for (const row of rows) {
    const token = row.token;
    const name = cleanText(row.nombre) || `Proveedor ${row.id}`;
    const legalName = cleanText(row.razonSocial);
    const rfc = cleanText(row.rfc);
    const email = cleanEmail(row.email);
    const phone = cleanPhone(row.telefono);
    const address = joinAddress([
      row.direccion,
      row.colonia,
      row.ciudad,
      row.estado,
      row.pais,
      row.cp,
    ]);
    const status = mapStatus(row.status);
    const productsServices = withLegacyTag(
      token,
      cleanText(row.tipo) ? `tipo:${row.tipo}` : null
    );

    const prev = byToken.get(token);
    if (prev) {
      await prisma.supplier.update({
        where: { id: prev.id },
        data: {
          name,
          legalName,
          rfc,
          email,
          phone,
          address,
          productsServices,
          supplierType: "PRODUCTS",
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : prev.deletedAt,
        },
      });
      updated += 1;
    } else {
      await prisma.supplier.create({
        data: {
          name,
          legalName,
          rfc,
          email,
          phone,
          address,
          productsServices,
          supplierType: "PRODUCTS",
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      created += 1;
    }
  }

  console.log(`  Proveedores: ${created} nuevos, ${updated} actualizados`);
}

async function importProcesses(rows, actorId) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const code = `PROC-${row.id}`;
    const name = cleanText(row.nombre) || code;
    const status = mapStatus(row.status);
    const unit = mapProcessUnit(row.unidad);
    const defaultRate = toMoney(row.precio);
    const description = withLegacyTag(row.token, null);

    const existing = await prisma.manufacturingProcess.findUnique({
      where: { code },
    });
    if (existing) {
      await prisma.manufacturingProcess.update({
        where: { code },
        data: {
          name,
          description,
          unit,
          defaultRate,
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : existing.deletedAt,
        },
      });
      updated += 1;
    } else {
      await prisma.manufacturingProcess.create({
        data: {
          code,
          name,
          description,
          unit,
          defaultRate,
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      created += 1;
    }
  }

  console.log(`  Procesos: ${created} nuevos, ${updated} actualizados`);
}

async function importInstallations(rows, actorId) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const code = `INST-${row.id}`;
    const name = cleanText(row.nombre) || code;
    const status = mapStatus(row.status);
    const unit = mapProcessUnit(row.unidad);
    const defaultPrice = toMoney(row.precio);
    const description = withLegacyTag(row.token, null);

    const existing = await prisma.installationConcept.findUnique({
      where: { code },
    });
    if (existing) {
      await prisma.installationConcept.update({
        where: { code },
        data: {
          name,
          description,
          unit,
          defaultPrice,
          status,
          updatedBy: actorId,
          deletedAt: status === "ACTIVE" ? null : existing.deletedAt,
        },
      });
      updated += 1;
    } else {
      await prisma.installationConcept.create({
        data: {
          code,
          name,
          description,
          unit,
          defaultPrice,
          status,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      created += 1;
    }
  }

  console.log(`  Instalaciones: ${created} nuevas, ${updated} actualizadas`);
}

async function importStock(rows, warehouseMap, itemMap, actorId) {
  let posted = 0;
  let skippedZero = 0;
  let skippedMissing = 0;
  let skippedExists = 0;

  for (const row of rows) {
    if (String(row.status) !== "1") continue;

    const qty = toDecimalQty(row.cantidad);
    if (qty <= 0) {
      skippedZero += 1;
      continue;
    }

    const warehouseId = warehouseMap.get(row.almacen);
    const itemId = itemMap.get(row.producto);
    if (!warehouseId || !itemId) {
      skippedMissing += 1;
      continue;
    }

    const referenceId = `legacy-stock:${row.token}`;
    const already = await prisma.inventoryMovement.findFirst({
      where: {
        referenceType: "INITIAL_BALANCE",
        referenceId,
      },
      select: { id: true },
    });
    if (already) {
      skippedExists += 1;
      continue;
    }

    // Apply min stock alert from legacy if present
    const alertaMin = toDecimalQty(row.alertaMin);
    if (alertaMin > 0) {
      await prisma.item.update({
        where: { id: itemId },
        data: { minimumStock: new Prisma.Decimal(alertaMin) },
      });
    }

    await prisma.$transaction(async (tx) => {
      await postInitialBalance(tx, {
        warehouseId,
        itemId,
        quantity: qty,
        referenceId,
        createdBy: actorId,
        notes: `Existencia legado id=${row.id}`,
      });
    });
    posted += 1;
  }

  console.log(
    `  Existencias: ${posted} saldos iniciales` +
      `, ${skippedExists} ya importados` +
      `, ${skippedZero} en cero` +
      `, ${skippedMissing} sin match item/almacén`
  );
}

async function main() {
  const dumpPath = DEFAULT_DUMP;
  const phase = (process.env.LEGACY_PHASE || "all").toLowerCase(); // all | catalogs | quotes
  console.log(`Importación legado desde:\n  ${dumpPath}\n  fase: ${phase}\n`);

  const actorId = await resolveActorUserId();
  console.log(`Usuario actor: ${actorId}`);

  const tablesNeeded =
    phase === "quotes"
      ? ["cotizaciones", "cotizacionesPartidas", "cotizacionesItems", "produccion"]
      : TABLES;

  console.log("Extrayendo tablas del dump...");
  const data = await extractTablesFromDump(dumpPath, tablesNeeded);
  for (const t of tablesNeeded) {
    console.log(`  ${t}: ${(data[t] || []).length} filas`);
  }

  if (phase === "all" || phase === "catalogs") {
    console.log("\nImportando catálogos...");
    const warehouseMap = await importWarehouses(data.almacenes, actorId);
    const categoryMap = await importCategories(data.itemsCategorias, actorId);
    const itemMap = await importItems(data.items, categoryMap, actorId);
    await importClients(data.clientes, actorId);
    await importSuppliers(data.proveedores, actorId);
    await importProcesses(data.comsaProcesos, actorId);
    await importInstallations(data.comsaInstalaciones, actorId);

    console.log("\nImportando existencias (saldo inicial)...");
    await importStock(data.almacenesExistencias, warehouseMap, itemMap, actorId);
  }

  if (phase === "all" || phase === "quotes") {
    console.log("\nImportando cotizaciones y producción...");
    await importQuotesAndProduction(prisma, {
      quotes: data.cotizaciones,
      partidas: data.cotizacionesPartidas,
      items: data.cotizacionesItems,
      production: data.produccion,
      actorId,
    });
  }

  console.log("\nListo. Órdenes de compra del legado no se importan (fuera de alcance).");
}

main()
  .catch((err) => {
    console.error("\nError en importación legado:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
