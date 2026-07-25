/**
 * Importa comsaOC + comsaOCItems hacia PurchaseOrder / Receipt (documental).
 * No mueve stock: el saldo ya viene de almacenesExistencias.
 */

import { Prisma } from "@prisma/client";
import { phpUnserialize } from "../scripts/php-unserialize.js";
import {
  calculatePurchaseHeaderTotals,
  calculatePurchaseLineTotals,
} from "../domains/purchase-orders/calculations.js";
import { toNumber } from "../lib/quotes/calculations.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(err) {
  const msg = String(err?.message || err || "");
  const code = err?.code;
  return (
    code === "P1001" ||
    code === "P1017" ||
    code === "P2024" ||
    /Can't reach database|connection pool|Timed out fetching/i.test(msg)
  );
}

async function withRetry(label, fn, { retries = 5, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === retries) throw err;
      const delay = baseDelayMs * attempt;
      console.warn(
        `  Reintento ${attempt}/${retries} (${label}) en ${delay}ms: ${err.message?.split("\n")[0] || err}`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

const LEGACY_RE = /^\[legacy:([^\]]+)\]/;

function cleanText(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (["n/a", "na", "fn/a", "null", "-", ".", "0"].includes(lower)) return null;
  return s;
}

function legacyTag(token) {
  return `[legacy:${token}]`;
}

function parseLegacyTag(text) {
  if (!text) return null;
  const m = String(text).match(LEGACY_RE);
  return m ? m[1] : null;
}

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  const s = String(value);
  if (s.startsWith("0000-00-00")) return fallback;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

function buildFolio(folioPx, folio, serie = "A") {
  const px = String(folioPx ?? "").trim();
  const n = String(folio ?? "").trim();
  if (!px || !n) return null;
  return `${px}-${n}-${serie || "A"}`;
}

function mapPoStatus(legacyStatus, hasReceiveDate) {
  const s = String(legacyStatus);
  if (s === "99") return "CANCELLED";
  if (s === "50" || hasReceiveDate) return "COMPLETED";
  if (s === "2") return "APPROVED";
  if (s === "98") return "PENDING_APPROVAL";
  return "DRAFT";
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function bumpFolioSequences(prisma, scope, maxByYm) {
  for (const [yearMonth, maxSeq] of maxByYm.entries()) {
    if (!yearMonth || !maxSeq) continue;
    const key = String(yearMonth);
    await withRetry(`folioSeq ${scope} ${key}`, async () => {
      const existing = await prisma.folioSequence.findUnique({
        where: { scope_yearMonth: { scope, yearMonth: key } },
      });
      if (!existing) {
        await prisma.folioSequence.create({
          data: { scope, yearMonth: key, lastValue: maxSeq },
        });
      } else if (existing.lastValue < maxSeq) {
        await prisma.folioSequence.update({
          where: { id: existing.id },
          data: { lastValue: maxSeq },
        });
      }
    });
  }
  console.log(
    `  Folio sequences actualizadas (${scope}): ${maxByYm.size} periodos`
  );
}

async function buildSupplierMap(prisma) {
  const rows = await prisma.supplier.findMany({
    where: { productsServices: { startsWith: "[legacy:" } },
    select: { id: true, productsServices: true },
  });
  const map = new Map();
  for (const s of rows) {
    const token = parseLegacyTag(s.productsServices);
    if (token) map.set(token, s.id);
  }
  return map;
}

async function ensureSupplier(prisma, supplierMap, token, actorId) {
  if (!token) return null;
  if (supplierMap.has(token)) return supplierMap.get(token);
  const created = await prisma.supplier.create({
    data: {
      name: `Proveedor legado ${token.slice(0, 8)}`,
      productsServices: legacyTag(token),
      supplierType: "PRODUCTS",
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  supplierMap.set(token, created.id);
  return created.id;
}

async function resolveByFolioPrefix(prisma, model, prefix) {
  const p = cleanText(prefix);
  if (!p || p === "0") return null;
  // Exact first, then prefix (legacy stores YYMM-n without serie)
  const exact = await prisma[model].findFirst({
    where: { folio: p },
    select: { id: true, folio: true },
  });
  if (exact) return exact.id;
  const row = await prisma[model].findFirst({
    where: { folio: { startsWith: `${p}-` } },
    orderBy: { folio: "desc" },
    select: { id: true },
  });
  return row?.id || null;
}

async function resolveCatalogItem(prisma, itemCache, lineToken, anexo, actorId) {
  const desc = cleanText(anexo.descripcion) || "Material legado";
  const skuPreferred = cleanText(anexo.noParte);
  const cacheKey = lineToken || `${desc}|${anexo.dimensiones || ""}`;

  if (itemCache.has(cacheKey)) return itemCache.get(cacheKey);

  if (skuPreferred) {
    const bySku = await prisma.item.findUnique({ where: { sku: skuPreferred } });
    if (bySku) {
      itemCache.set(cacheKey, bySku.id);
      return bySku.id;
    }
  }

  const byName = await prisma.item.findFirst({
    where: {
      deletedAt: null,
      name: { equals: desc, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (byName) {
    itemCache.set(cacheKey, byName.id);
    return byName.id;
  }

  const sku = `LEGACY-OC-${(lineToken || cacheKey).slice(0, 28)}`;
  const existingSku = await prisma.item.findUnique({ where: { sku } });
  if (existingSku) {
    itemCache.set(cacheKey, existingSku.id);
    return existingSku.id;
  }

  const created = await prisma.item.create({
    data: {
      sku,
      name: desc.slice(0, 200),
      description: [
        cleanText(anexo.tipoMaterial) ? `Material: ${anexo.tipoMaterial}` : null,
        cleanText(anexo.dimensiones) ? `Dim: ${anexo.dimensiones}` : null,
        legacyTag(lineToken || sku),
      ]
        .filter(Boolean)
        .join(" | "),
      itemType: "RAW_MATERIAL",
      isInventoryControlled: true,
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  itemCache.set(cacheKey, created.id);
  return created.id;
}

function buildSnapshot(anexo) {
  const parts = [
    cleanText(anexo.descripcion) || "Material",
    cleanText(anexo.tipoMaterial),
    cleanText(anexo.dimensiones),
    cleanText(anexo.noParte) ? `PN:${anexo.noParte}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
export async function importPurchaseOrders(prisma, { orders, items, actorId }) {
  const supplierMap = await buildSupplierMap(prisma);
  const itemsByOc = indexBy(items, (r) => r.rel);

  const warehouse = await prisma.warehouse.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!warehouse) {
    throw new Error("No hay almacenes; importa catálogos primero.");
  }

  const existingPos = await prisma.purchaseOrder.findMany({
    where: { comments: { startsWith: "[legacy:" } },
    select: { id: true, folio: true, comments: true },
  });
  const existingFolios = new Set(existingPos.map((p) => p.folio));
  const existingTokens = new Set(
    existingPos.map((p) => parseLegacyTag(p.comments)).filter(Boolean)
  );

  const itemCache = new Map();
  const folioMaxPo = new Map();
  const folioMaxRc = new Map();

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let receipts = 0;
  let linkedQuote = 0;
  let linkedProd = 0;

  console.log(`  OC a procesar: ${orders.length}`);

  for (let idx = 0; idx < orders.length; idx += 1) {
    const row = orders[idx];
    const token = row.token;
    if (!token) {
      skipped += 1;
      continue;
    }

    const folio = buildFolio(row.folioPx, row.folio, "A");
    if (!folio) {
      skipped += 1;
      continue;
    }

    const ym = String(row.folioPx);
    const seq = Number(row.folio) || 0;
    const prevMax = folioMaxPo.get(ym) || 0;
    if (seq > prevMax) folioMaxPo.set(ym, seq);

    if (existingFolios.has(folio) || existingTokens.has(token)) {
      skipped += 1;
      continue;
    }

    const receiveDate = parseDate(row.fechaRecibe);
    const status = mapPoStatus(row.status, Boolean(receiveDate));
    const requestDate =
      parseDate(row.fechaRegistro) || parseDate(row.fechaAutoriza) || new Date();
    const authorizationDate = parseDate(row.fechaAutoriza);
    const completedAt =
      status === "COMPLETED" ? receiveDate || authorizationDate || requestDate : null;

    try {
      await withRetry(`oc ${folio}`, async () => {
        // Si otra corrida / retry creó el folio, tratar como ya importado
        const already = await prisma.purchaseOrder.findFirst({
          where: {
            OR: [
              { folio },
              { comments: { startsWith: legacyTag(token) } },
            ],
          },
          select: { id: true, folio: true },
        });
        if (already) {
          existingFolios.add(already.folio);
          existingTokens.add(token);
          skipped += 1;
          return;
        }

        let supplierId = await ensureSupplier(
          prisma,
          supplierMap,
          cleanText(row.proveedor),
          actorId
        );
        if (!supplierId) {
          supplierId = await ensureSupplier(
            prisma,
            supplierMap,
            `MISSING-OC-${row.id}`,
            actorId
          );
        }

        const quoteId = await resolveByFolioPrefix(
          prisma,
          "quote",
          row.cotizacion
        );
        const productionOrderId = await resolveByFolioPrefix(
          prisma,
          "productionOrder",
          row.produccion
        );
        if (quoteId) linkedQuote += 1;
        if (productionOrderId) linkedProd += 1;

        const lineRows = itemsByOc.get(token) || [];
        const poItemCreates = [];
        const lineTotalsAcc = [];

        for (const line of lineRows) {
          if (String(line.status) === "0") continue;
          const anexo = phpUnserialize(line.anexo) || {};
          const qty = toNumber(anexo.cantidad) || 1;
          const unitPrice = toNumber(anexo.precio);
          const totals = calculatePurchaseLineTotals(qty, unitPrice);
          const itemId = await resolveCatalogItem(
            prisma,
            itemCache,
            line.token,
            anexo,
            actorId
          );
          const lineReceived =
            status === "COMPLETED" || Boolean(parseDate(line.fechaRecibe));

          poItemCreates.push({
            itemId,
            descriptionSnapshot: buildSnapshot(anexo),
            quantity: new Prisma.Decimal(qty),
            receivedQuantity: new Prisma.Decimal(lineReceived ? qty : 0),
            unit: null,
            unitPrice: new Prisma.Decimal(unitPrice),
            subtotal: new Prisma.Decimal(totals.subtotal),
            taxAmount: new Prisma.Decimal(totals.taxAmount),
            total: new Prisma.Decimal(totals.total),
            warehouseId: warehouse.id,
            status: lineReceived ? "RECEIVED" : "PENDING",
          });
          lineTotalsAcc.push(totals);
        }

        const headerTotals = calculatePurchaseHeaderTotals(lineTotalsAcc);
        const comments = [
          legacyTag(token),
          cleanText(row.obs),
          cleanText(row.proveedorVendedor)
            ? `vendedor:${row.proveedorVendedor}`
            : null,
          "Import documental (sin movimiento de stock)",
        ]
          .filter(Boolean)
          .join(" | ");

        const po = await prisma.purchaseOrder.create({
          data: {
            folio,
            supplierId,
            quoteId,
            productionOrderId,
            requestedBy: actorId,
            authorizedBy:
              status === "APPROVED" || status === "COMPLETED" || status === "CANCELLED"
                ? actorId
                : null,
            requestDate,
            authorizationDate,
            status,
            comments,
            subtotal: new Prisma.Decimal(headerTotals.subtotal),
            tax: new Prisma.Decimal(headerTotals.tax),
            total: new Prisma.Decimal(headerTotals.total),
            completedAt,
            createdBy: actorId,
            updatedBy: actorId,
            items: poItemCreates.length
              ? { create: poItemCreates }
              : undefined,
          },
          include: { items: true },
        });

        existingFolios.add(folio);
        existingTokens.add(token);
        created += 1;

        // Documentary receipt — no stock engine
        if (status === "COMPLETED" && po.items.length > 0) {
          const rcDate = receiveDate || completedAt || requestDate;
          const rcYm = `${String(rcDate.getFullYear()).slice(-2)}${String(
            rcDate.getMonth() + 1
          ).padStart(2, "0")}`;
          const rcSeq = (folioMaxRc.get(rcYm) || 0) + 1;
          folioMaxRc.set(rcYm, rcSeq);
          const rcFolio = `${rcYm}-${rcSeq}-A`;

          await prisma.purchaseReceipt.create({
            data: {
              folio: rcFolio,
              purchaseOrderId: po.id,
              supplierId,
              warehouseId: warehouse.id,
              receiptDate: rcDate,
              notes: `${legacyTag(token)} Recepción histórica (sin posteo de inventario)`,
              receivedBy: actorId,
              items: {
                create: po.items.map((it) => ({
                  purchaseOrderItemId: it.id,
                  itemId: it.itemId,
                  orderedQuantity: it.quantity,
                  previouslyReceivedQuantity: new Prisma.Decimal(0),
                  receivedQuantity: it.quantity,
                  unitCost: it.unitPrice,
                })),
              },
            },
          });
          receipts += 1;
        }
      });
    } catch (err) {
      // Create succeeded but response/retry hit unique folio → ya está importada
      if (err?.code === "P2002") {
        existingFolios.add(folio);
        existingTokens.add(token);
        skipped += 1;
        continue;
      }
      failed += 1;
      if (failed <= 20) {
        console.warn(
          `  OC omitida id=${row.id} folio=${folio}: ${err.message?.split("\n")[0]}`
        );
      }
    }

    if ((idx + 1) % 250 === 0) {
      console.log(
        `  ... progreso OC ${idx + 1}/${orders.length} (nuevas ${created}, omitidas ${skipped}, fallidas ${failed})`
      );
    }
  }

  console.log(
    `  OC: ${created} nuevas, ${skipped} omitidas, ${failed} fallidas` +
      ` | vínculos quote=${linkedQuote} prod=${linkedProd} | recepciones doc=${receipts}`
  );

  await bumpFolioSequences(prisma, "PURCHASE_ORDER", folioMaxPo);
  await bumpFolioSequences(prisma, "PURCHASE_RECEIPT", folioMaxRc);

  return {
    created,
    skipped,
    failed,
    receipts,
    linkedQuote,
    linkedProd,
  };
}
