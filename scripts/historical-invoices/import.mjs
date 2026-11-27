/**
 * Importa el historico de facturacion (JSON de parse_workbook.py) a
 * historical_invoices. Idempotente: la llave es factura + anio; al reimportar
 * actualiza los datos del Excel y conserva las ligas manuales a cotizacion.
 *
 * Ademas:
 *  - Cliente: coincidencia por nombre (exacta o prefijo unico) y, si no, el
 *    cliente de la cotizacion ligada por PO para ese mismo nombre capturado.
 *  - Vendedor: alias (edson, teo...) -> usuario cuyo nombre contiene el alias.
 *  - Cotizacion: liga automatica cuando el PO coincide con UNA sola cotizacion
 *    emitida antes de la factura (linkMethod PO_AUTO).
 *
 * Uso:
 *   DATABASE_URL=... node scripts/historical-invoices/import.mjs <hist.json>            (simulacion)
 *   DATABASE_URL=... node scripts/historical-invoices/import.mjs <hist.json> --execute
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const [, , file, ...flags] = process.argv;
const EXECUTE = flags.includes("--execute");
if (!file) {
  console.error("Uso: node scripts/historical-invoices/import.mjs <hist.json> [--execute]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const MONTH_WORDS = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|sept?iembre|octubre|noviembre|diciembre)$/i;

const normName = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?\s?a\.?|de c\.?\s?v\.?|s\. de r\.l\.|sapi|mexico|méxico)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const normPo = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function dedupe(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.period) continue;
    const key = `${r.invoice}|${r.period.slice(0, 4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  let dropped = 0;
  for (const [, list] of groups) {
    // Renglones "apartados" (monto 0 con el mes como cliente) se descartan si
    // hay otro renglon con la misma factura.
    let keep = list.length > 1 ? list.filter((r) => !(r.amount === 0 && MONTH_WORDS.test(r.client))) : list;
    if (!keep.length) keep = [list[0]];
    if (keep.length > 1) {
      const withAmount = keep.filter((r) => r.amount > 0 || r.cancelled);
      if (withAmount.length) keep = withAmount;
    }
    dropped += list.length - keep.length;
    keep.forEach((r, i) => out.push({ ...r, invoiceNumber: i === 0 ? r.invoice : `${r.invoice}-${i + 1}` }));
  }
  return { rows: out, dropped };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const { rows, dropped } = dedupe(raw);
  console.log(`Renglones en archivo: ${raw.length} · a importar: ${rows.length} · descartados por duplicado: ${dropped}`);

  // ---------- clientes
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, commercialName: true, legalName: true },
  });
  const exact = new Map();
  for (const c of clients) {
    for (const n of [c.commercialName, c.legalName]) {
      const k = normName(n);
      if (k && !exact.has(k)) exact.set(k, c.id);
    }
  }
  const clientNames = clients.map((c) => ({ id: c.id, k: normName(c.commercialName) }));
  const clientCache = new Map();
  function matchClient(name) {
    const k = normName(name);
    if (!k) return null;
    if (clientCache.has(k)) return clientCache.get(k);
    let id = exact.get(k) || null;
    if (!id && k.length >= 4) {
      const hits = clientNames.filter((c) => c.k.startsWith(k) || (c.k.length >= 4 && k.startsWith(c.k)));
      if (hits.length === 1) id = hits[0].id;
    }
    clientCache.set(k, id);
    return id;
  }

  // ---------- vendedores
  // Solo usuarios que han vendido (vendedor de alguna cotizacion o factura).
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ quotesAsSeller: { some: {} } }, { salesInvoicesAsSeller: { some: {} } }],
    },
    select: { id: true, name: true },
  });
  const sellerMap = new Map();
  const aliases = [...new Set(rows.map((r) => r.seller).filter(Boolean))];
  for (const alias of aliases) {
    if (alias.length < 3) continue;
    const hits = users.filter((u) => normName(u.name).split(" ").includes(normName(alias)));
    if (hits.length === 1) sellerMap.set(alias, hits[0]);
  }
  console.log(
    "Vendedores ligados:",
    [...sellerMap.entries()].map(([a, u]) => `${a}→${u.name}`).join(", ") || "ninguno"
  );

  // ---------- cotizaciones por PO
  const quotes = await prisma.quote.findMany({
    where: { deletedAt: null, purchaseOrder: { not: null } },
    select: { id: true, purchaseOrder: true, elaborationDate: true, clientId: true },
  });
  const byPo = new Map();
  for (const q of quotes) {
    const k = normPo(q.purchaseOrder);
    if (k.length < 4) continue;
    if (!byPo.has(k)) byPo.set(k, []);
    byPo.get(k).push(q);
  }
  function quoteForPo(po, date) {
    const hits = (byPo.get(normPo(po)) || []).filter((q) => !q.elaborationDate || q.elaborationDate <= date);
    return hits.length === 1 ? hits[0] : null;
  }

  // Nombre capturado -> cliente aprendido de las cotizaciones ligadas por PO.
  const learned = new Map();
  for (const r of rows) {
    const q = r.po ? quoteForPo(r.po, new Date(`${r.date}T00:00:00Z`)) : null;
    if (!q?.clientId) continue;
    const k = normName(r.client);
    if (!learned.has(k)) learned.set(k, new Map());
    const m = learned.get(k);
    m.set(q.clientId, (m.get(q.clientId) || 0) + 1);
  }
  const learnedClient = (name) => {
    const m = learned.get(normName(name));
    if (!m) return null;
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  const data = rows.map((r) => {
    const date = new Date(`${r.date}T00:00:00Z`);
    const quote = r.po ? quoteForPo(r.po, date) : null;
    return {
      invoiceNumber: r.invoiceNumber,
      year: Number(r.period.slice(0, 4)),
      invoiceDate: date,
      amount: r.cancelled ? 0 : r.amount,
      series: r.series || "NUM",
      isResale: Boolean(r.isResale),
      cancelled: Boolean(r.cancelled),
      clientName: r.client.slice(0, 200),
      clientId: quote?.clientId || matchClient(r.client) || learnedClient(r.client),
      sellerAlias: r.seller || null,
      sellerId: sellerMap.get(r.seller)?.id || null,
      description: r.description || null,
      poNumber: r.po || null,
      orderRef: r.order || null,
      laborAmount: r.laborAmount && Number.isFinite(r.laborAmount) && Math.abs(r.laborAmount) < 1e10 ? r.laborAmount : null,
      notes: [r.flag, r.replaces ? `reemplaza ${r.replaces}` : null].filter(Boolean).join(" · ") || null,
      sourceSheet: r.sheet,
      dateEstimated: Boolean(r.dateFixed),
      quoteId: quote?.id || null,
      linkMethod: quote ? "PO_AUTO" : null,
      linkedAt: quote ? new Date() : null,
    };
  });

  const stats = {
    total: data.length,
    conCliente: data.filter((d) => d.clientId).length,
    conVendedor: data.filter((d) => d.sellerId).length,
    ligadasPorPO: data.filter((d) => d.quoteId).length,
    canceladas: data.filter((d) => d.cancelled).length,
    fechaEstimada: data.filter((d) => d.dateEstimated).length,
  };
  console.log(stats);

  const existing = await prisma.historicalInvoice.findMany({
    select: { id: true, invoiceNumber: true, year: true, linkMethod: true },
  });
  // Las ligadas a mano (MANUAL) se actualizan una por una conservando su
  // cotizacion; todo lo demas se reemplaza en bloque (rapido e idempotente).
  const manualByKey = new Map(
    existing.filter((e) => e.linkMethod === "MANUAL").map((e) => [`${e.invoiceNumber}|${e.year}`, e])
  );
  const manualUpdates = data.filter((d) => manualByKey.has(`${d.invoiceNumber}|${d.year}`));
  const bulk = data.filter((d) => !manualByKey.has(`${d.invoiceNumber}|${d.year}`));
  const fileKeys = new Set(data.map((d) => `${d.invoiceNumber}|${d.year}`));
  const existingKeys = new Set(existing.map((e) => `${e.invoiceNumber}|${e.year}`));
  const removed = existing.filter((e) => !fileKeys.has(`${e.invoiceNumber}|${e.year}`) && e.linkMethod !== "MANUAL");
  console.log(
    `Nuevas: ${data.filter((d) => !existingKeys.has(`${d.invoiceNumber}|${d.year}`)).length}` +
      ` · se reemplazan: ${bulk.length} · ligadas a mano que se conservan: ${manualUpdates.length}` +
      ` · ya no vienen en el archivo: ${removed.length}`
  );

  if (!EXECUTE) {
    console.log("Simulación: no se escribió nada. Agrega --execute para importar.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const deleted = await tx.historicalInvoice.deleteMany({
        where: { OR: [{ linkMethod: null }, { linkMethod: { not: "MANUAL" } }] },
      });
      console.log(`Reemplazo: ${deleted.count} renglones anteriores eliminados`);
      for (let i = 0; i < bulk.length; i += 2000) {
        await tx.historicalInvoice.createMany({ data: bulk.slice(i, i + 2000) });
        process.stdout.write(`\rCreadas ${Math.min(i + 2000, bulk.length)}/${bulk.length}`);
      }
      if (bulk.length) process.stdout.write("\n");
      for (const d of manualUpdates) {
        const prev = manualByKey.get(`${d.invoiceNumber}|${d.year}`);
        const { quoteId, linkMethod, linkedAt, ...rest } = d;
        await tx.historicalInvoice.update({ where: { id: prev.id }, data: rest });
      }
    },
    { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 }
  );
  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
