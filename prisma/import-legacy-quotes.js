import { phpUnserialize } from "../scripts/php-unserialize.js";
import {
  calculateQuoteHeaderTotals,
  calculateQuoteItemTotals,
  lineAmount,
  money,
  toNumber,
} from "../lib/quotes/calculations.js";

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
  if (["n/a", "na", "fn/a", "null", "-", "."].includes(lower)) return null;
  return s;
}

function legacyTag(token) {
  return `[legacy:${token}]`;
}

function withLegacyTag(token, rest) {
  const tag = legacyTag(token);
  const body = cleanText(rest);
  return body ? `${tag} ${body}` : tag;
}

function parseLegacyTag(text) {
  if (!text) return null;
  const m = String(text).match(LEGACY_RE);
  return m ? m[1] : null;
}

function parseDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
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

function mapQuoteStatus(legacyStatus, hasProduction) {
  if (hasProduction) return "IN_PRODUCTION";
  const s = String(legacyStatus);
  if (s === "0" || s === "1") return "DRAFT";
  if (s === "98") return "PENDING_APPROVAL";
  if (s === "99") return "CANCELLED";
  if (s === "2" || s === "1.1" || s === "3" || s === "50") return "APPROVED";
  return "DRAFT";
}

function mapProductionStatus(legacyStatus) {
  const s = String(legacyStatus);
  if (s === "1" || s === "2") return "IN_PROGRESS";
  if (s === "3" || s === "50") return "COMPLETED";
  if (s === "99") return "CANCELLED";
  return "PENDING";
}

function buildFolio(folioPx, folio, serie = "A") {
  const px = String(folioPx ?? "").trim();
  const n = String(folio ?? "").trim();
  const ser = cleanText(serie) || "A";
  if (!px || !n) return null;
  return `${px}-${n}-${ser}`;
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

async function ensureIssuingCompany(prisma, actorId) {
  const existing = await prisma.issuingCompany.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const created = await prisma.issuingCompany.create({
    data: {
      commercialName: "COMSA PRO",
      legalName: "COMSA PRO",
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  return created.id;
}

async function buildClientMap(prisma) {
  const clients = await prisma.client.findMany({
    where: { companyProfile: { startsWith: "[legacy:" } },
    select: { id: true, companyProfile: true },
  });
  const map = new Map();
  for (const c of clients) {
    const token = parseLegacyTag(c.companyProfile);
    if (token) map.set(token, c.id);
  }
  return map;
}

async function ensureClient(prisma, clientMap, token, actorId) {
  if (!token) return { id: null, created: false };
  if (clientMap.has(token)) return { id: clientMap.get(token), created: false };

  const created = await prisma.client.create({
    data: {
      commercialName: `Cliente legado ${token.slice(0, 8)}`,
      companyProfile: legacyTag(token),
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  clientMap.set(token, created.id);
  return { id: created.id, created: true };
}

async function buildProcessNameMap(prisma) {
  const rows = await prisma.manufacturingProcess.findMany({
    select: { id: true, name: true },
  });
  const map = new Map();
  for (const r of rows) {
    map.set(String(r.name).trim().toLowerCase(), r.id);
  }
  return map;
}

async function buildInstallationNameMap(prisma) {
  const rows = await prisma.installationConcept.findMany({
    select: { id: true, name: true },
  });
  const map = new Map();
  for (const r of rows) {
    map.set(String(r.name).trim().toLowerCase(), r.id);
  }
  return map;
}

function buildChildLines(itemRows, processMap, installationMap) {
  const manufacturing = [];
  const materials = [];
  const extras = [];
  const installations = [];

  let mSort = 0;
  for (const row of itemRows) {
    if (String(row.status) === "0") continue;
    const grupo = String(row.grupo || "").toLowerCase();
    const qty = toNumber(row.cantidad) || 1;
    const unitPrice = toNumber(row.precioUnitario);
    const amount = lineAmount(qty, unitPrice);
    const desc = cleanText(row.descripcion) || "Sin descripcion";
    const unit = cleanText(row.unidad);

    if (grupo === "manufactura") {
      manufacturing.push({
        manufacturingProcessId:
          processMap.get(desc.toLowerCase()) || null,
        processNameSnapshot: desc,
        unitSnapshot: mapProcessUnit(unit),
        quantity: qty,
        unitRate: unitPrice,
        amount,
        observations: cleanText(row.obs),
        sortOrder: mSort++,
      });
    } else if (grupo === "materiales") {
      materials.push({
        descriptionSnapshot: desc,
        dimensions: cleanText(row.dimensiones),
        presentation: cleanText(row.presentacion),
        unit,
        quantity: qty,
        unitPrice,
        amount,
        observations: cleanText(row.obs),
      });
    } else if (grupo === "extras") {
      extras.push({
        description: desc,
        quantity: qty,
        unit,
        unitPrice,
        amount,
        observations: cleanText(row.obs),
      });
    } else if (grupo === "instalacion" || grupo === "instalación") {
      installations.push({
        installationConceptId:
          installationMap.get(desc.toLowerCase()) || null,
        conceptNameSnapshot: desc,
        unitSnapshot: mapProcessUnit(unit),
        quantity: qty,
        unitPrice,
        amount,
        observations: cleanText(row.obs),
      });
    } else if (desc) {
      // Unknown grupo → treat as extra line so cost is not lost
      extras.push({
        description: `[${grupo || "otro"}] ${desc}`,
        quantity: qty,
        unit,
        unitPrice,
        amount,
        observations: cleanText(row.obs),
      });
    }
  }

  return { manufacturing, materials, extras, installations };
}

/**
 * Import quotes + production from legacy dump tables.
 * @returns {{ quoteTokenToId: Map<string,string>, stats: object }}
 */
export async function importQuotesAndProduction(prisma, {
  quotes,
  partidas,
  items,
  production,
  actorId,
}) {
  const issuingCompanyId = await ensureIssuingCompany(prisma, actorId);
  const clientMap = await buildClientMap(prisma);
  const processMap = await buildProcessNameMap(prisma);
  const installationMap = await buildInstallationNameMap(prisma);

  const partidasByQuote = indexBy(partidas, (r) => r.relCot);
  const itemsByPartida = indexBy(items, (r) => r.relPar);
  const productionByQuoteToken = indexBy(
    production.filter((p) => p.moduloRel === "cotizaciones"),
    (p) => p.moduloToken
  );

  const existingQuotes = await prisma.quote.findMany({
    where: { internalObservations: { startsWith: "[legacy:" } },
    select: { id: true, folio: true, internalObservations: true },
  });
  const existingByToken = new Map();
  for (const q of existingQuotes) {
    const token = parseLegacyTag(q.internalObservations);
    if (token) existingByToken.set(token, q.id);
  }

  const quoteTokenToId = new Map(existingByToken);
  const folioMaxByYm = new Map();

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let stubClients = 0;

  console.log(`  Cotizaciones a procesar: ${quotes.length}`);

  for (let idx = 0; idx < quotes.length; idx += 1) {
    const row = quotes[idx];
    const token = row.token;
    if (!token) {
      skipped += 1;
      continue;
    }

    const folio = buildFolio(row.folioPx, row.folio, row.serie);
    if (!folio) {
      skipped += 1;
      continue;
    }

    const ym = String(row.folioPx);
    const seq = Number(row.folio) || 0;
    const prevMax = folioMaxByYm.get(ym) || 0;
    if (seq > prevMax) folioMaxByYm.set(ym, seq);

    if (quoteTokenToId.has(token)) {
      skipped += 1;
      continue;
    }

    const hasProduction = (productionByQuoteToken.get(token) || []).length > 0;
    const status = mapQuoteStatus(row.status, hasProduction);
    const anexo = phpUnserialize(row.anexo) || {};

    let { id: clientId, created: clientCreated } = await ensureClient(
      prisma,
      clientMap,
      row.cliente,
      actorId
    );
    if (!clientId) {
      ({ id: clientId, created: clientCreated } = await ensureClient(
        prisma,
        clientMap,
        `MISSING-${row.id}`,
        actorId
      ));
    }
    if (clientCreated) stubClients += 1;

    const elaborationDate = parseDate(row.fechaElaboracion, parseDate(row.fechaRegistro));
    const validUntil = parseDate(row.fechaVigencia, elaborationDate);
    const advancePercentage = money(anexo.notasPorcentaje1 ?? 0);
    const settlementPercentage = money(anexo.notasPorcentaje2 ?? 100);
    const purchaseOrder = cleanText(anexo.oc);
    const requisition = cleanText(anexo.req);
    const paymentNotes = cleanText(anexo.notasOtras);
    const internalObservations = withLegacyTag(
      token,
      [cleanText(row.obs), cleanText(anexo.aprobadoPor) ? `aprobadoPor:${anexo.aprobadoPor}` : null]
        .filter(Boolean)
        .join(" | ")
    );

    const quotePartidas = (partidasByQuote.get(token) || [])
      .slice()
      .sort((a, b) => (Number(a.posicion) || 0) - (Number(b.posicion) || 0));

    const itemCreates = [];
    const itemTotalsAcc = [];

    quotePartidas.forEach((partida, pIdx) => {
      if (String(partida.status) === "0") return;
      const partidaAnexo = phpUnserialize(partida.anexo) || {};
      const benefitPercentage = money(partidaAnexo.beneficio ?? 30);
      const discountPercentage = money(partida.descuento ?? 0);
      const childRows = itemsByPartida.get(partida.token) || [];
      const children = buildChildLines(
        childRows,
        processMap,
        installationMap
      );
      const totals = calculateQuoteItemTotals({
        ...children,
        benefitPercentage,
        discountPercentage,
      });
      itemTotalsAcc.push(totals);

      itemCreates.push({
        position: Number(partida.posicion) || pIdx + 1,
        description:
          cleanText(partida.descripcion) || `Partida ${pIdx + 1}`,
        quantity: toNumber(partida.cantidad) || 1,
        unit: null,
        clientObservations: cleanText(partida.obs),
        internalObservations: cleanText(partidaAnexo.tiempoEntrega)
          ? `Entrega: ${partidaAnexo.tiempoEntrega}`
          : null,
        benefitPercentage,
        discountPercentage,
        isUrgent: String(partida.flagUrgente) === "1",
        status: "ACTIVE",
        ...totals,
        manufacturing: { create: children.manufacturing },
        materials: { create: children.materials },
        extras: { create: children.extras },
        installations: { create: children.installations },
      });
    });

    const headerTotals = calculateQuoteHeaderTotals(itemTotalsAcc);

    try {
      const createdQuote = await withRetry(`quote ${folio}`, () =>
        prisma.quote.create({
          data: {
            folio,
            version: cleanText(row.serie) || "A",
            clientId,
            sellerId: actorId,
            issuingCompanyId,
            orderType: "GENERAL",
            currency: "MXN",
            elaborationDate,
            validUntil,
            purchaseOrder,
            requisition,
            internalObservations,
            advancePercentage,
            settlementPercentage,
            paymentNotes,
            status,
            ...headerTotals,
            createdBy: actorId,
            updatedBy: actorId,
            items: itemCreates.length ? { create: itemCreates } : undefined,
          },
        })
      );
      quoteTokenToId.set(token, createdQuote.id);
      created += 1;
    } catch (err) {
      failed += 1;
      if (failed <= 15) {
        console.warn(
          `  Cotizacion omitida id=${row.id} folio=${folio}: ${err.message}`
        );
      }
    }

    if ((idx + 1) % 250 === 0) {
      console.log(
        `  ... progreso cotizaciones ${idx + 1}/${quotes.length} (nuevas ${created}, omitidas ${skipped}, fallidas ${failed})`
      );
    }
  }

  console.log(
    `  Cotizaciones: ${created} nuevas, ${skipped} ya existian/omitidas, ${failed} fallidas`
  );

  // --- Production orders ---
  let prodCreated = 0;
  let prodSkipped = 0;
  let prodFailed = 0;
  const prodFolioMax = new Map();

  const existingProd = await prisma.productionOrder.findMany({
    where: { folio: { not: "" } },
    select: { folio: true },
  });
  const existingProdFolios = new Set(existingProd.map((p) => p.folio));

  for (let idx = 0; idx < production.length; idx += 1) {
    const row = production[idx];
    if (row.moduloRel !== "cotizaciones") {
      prodSkipped += 1;
      continue;
    }
    const quoteId = quoteTokenToId.get(row.moduloToken);
    if (!quoteId) {
      prodSkipped += 1;
      continue;
    }

    const folio = buildFolio(row.folioPx, row.folio, "A");
    if (!folio || existingProdFolios.has(folio)) {
      prodSkipped += 1;
      continue;
    }

    const ym = String(row.folioPx);
    const seq = Number(row.folio) || 0;
    const prevMax = prodFolioMax.get(ym) || 0;
    if (seq > prevMax) prodFolioMax.set(ym, seq);

    try {
      await withRetry(`production ${folio}`, async () => {
        const quote = await prisma.quote.findUnique({
          where: { id: quoteId },
          include: { items: { orderBy: { position: "asc" } } },
        });
        if (!quote) {
          prodSkipped += 1;
          return;
        }
        if (quote.productionOrderId) {
          prodSkipped += 1;
          return;
        }

        const status = mapProductionStatus(row.status);
        const approvalDate = parseDate(
          row.fechaRegistro,
          parseDate(row.fechaEntrega)
        );

        const productionOrder = await prisma.productionOrder.create({
          data: {
            folio,
            sourceType: "QUOTE",
            clientId: quote.clientId,
            approvalDate,
            status,
            totalItems: quote.items.length,
            completedItems: 0,
            progressPercentage: 0,
            createdBy: actorId,
            updatedBy: actorId,
            items: {
              create: quote.items.map((item) => ({
                sourceItemId: item.id,
                sourceItemType: "QUOTE_ITEM",
                position: item.position,
                description: item.description,
                quantity: item.quantity,
                status: status === "COMPLETED" ? "COMPLETED" : "PENDING",
              })),
            },
          },
        });

        await prisma.quote.update({
          where: { id: quoteId },
          data: {
            status: "IN_PRODUCTION",
            productionOrderId: productionOrder.id,
            updatedBy: actorId,
          },
        });

        existingProdFolios.add(folio);
        prodCreated += 1;
      });
    } catch (err) {
      prodFailed += 1;
      if (prodFailed <= 15) {
        console.warn(
          `  Produccion omitida id=${row.id} folio=${folio}: ${err.message}`
        );
      }
    }

    if ((idx + 1) % 250 === 0) {
      console.log(
        `  ... progreso produccion ${idx + 1}/${production.length} (nuevas ${prodCreated})`
      );
    }
  }

  console.log(
    `  Produccion: ${prodCreated} nuevas, ${prodSkipped} omitidas, ${prodFailed} fallidas`
  );

  // Bump folio sequences so new docs don't collide
  await bumpFolioSequences(prisma, "QUOTE", folioMaxByYm);
  await bumpFolioSequences(prisma, "PRODUCTION", prodFolioMax);

  return {
    quoteTokenToId,
    stats: {
      quotesCreated: created,
      quotesSkipped: skipped,
      quotesFailed: failed,
      productionCreated: prodCreated,
      productionSkipped: prodSkipped,
      productionFailed: prodFailed,
      stubClients,
    },
  };
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
  console.log(`  Folio sequences actualizadas (${scope}): ${maxByYm.size} periodos`);
}
