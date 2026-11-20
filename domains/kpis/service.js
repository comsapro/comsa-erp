import "server-only";
import { requirePermission } from "@/lib/permissions/require-permission";
import { jsonOk } from "@/lib/api/http";
import {
  addDaysKey,
  asOfKey,
  buildBuckets,
  diffDays,
  inRange,
  isDayKey,
  previousPeriod,
  readPeriodParams,
  resolvePeriod,
  todayKey,
  trailingBuckets,
  weekRange,
  isoWeek,
  maxKey,
} from "./periods";
import {
  classifyCommitments,
  collectionStats,
  cumulativeBilling,
  delta,
  goalTargetsForRange,
  pendingReceptionHistory,
  qualityStats,
  receptionStats,
  salesProgress,
  num,
} from "./calculations";
import {
  historySinceKey,
  loadGoals,
  loadInvoices,
  loadQualityErrors,
  loadReworkTotals,
  loadTrackingRows,
} from "./data";
import { getCatalogMaps, getKpiSettings } from "./settings";

export function periodFromRequest(request, now = new Date()) {
  const url = new URL(request.url);
  return resolvePeriod(readPeriodParams(url.searchParams), now);
}

// -----------------------------------------------------------------------------
// KPI 1 — Compromisos (semana de junta)
// -----------------------------------------------------------------------------

export async function computeCommitments({ dateKey, settings }) {
  const today = todayKey();
  const ref = isDayKey(dateKey) ? dateKey : today;
  const week = weekRange(ref);
  const windowFrom = addDaysKey(week.from, -7);
  const windowTo = maxKey(addDaysKey(week.to, 7), addDaysKey(today, settings.upcomingDays));
  const rows = await loadTrackingRows({ windowFrom, windowTo, today });
  const result = classifyCommitments(rows, {
    today,
    weekKey: ref,
    upcomingDays: settings.upcomingDays,
  });
  return {
    today,
    weekNumber: isoWeek(week.from).week,
    ...result,
    stoppedIncidents: rows.reduce((s, r) => s + r.openBlockingIncidents, 0),
  };
}

// -----------------------------------------------------------------------------
// KPI 2 — Ventas
// -----------------------------------------------------------------------------

function salesForRange({ goals, invoices, range, taxRate }) {
  const inPeriod = invoices.filter((inv) => inRange(inv.invoiceDate, range));
  const targets = goalTargetsForRange(goals, range, taxRate);
  const progress = salesProgress(targets, inPeriod, taxRate);
  return { targets, progress, invoices: inPeriod };
}

export function computeSales({ goals, invoices, period, settings }) {
  const { progress, invoices: inPeriod } = salesForRange({
    goals,
    invoices,
    range: period,
    taxRate: settings.taxRate,
  });
  const days = diffDays(period.from, period.to) + 1;
  const groupBy = days <= 45 ? "week" : "month";
  const buckets = buildBuckets(period.from, period.to, groupBy).map((b) => ({
    ...b,
    from: maxKey(b.from, period.from),
    to: b.to > period.to ? period.to : b.to,
  }));
  const bySeller = new Map();
  for (const inv of inPeriod) {
    const key = inv.sellerId;
    if (!bySeller.has(key)) bySeller.set(key, { sellerId: key, sellerName: inv.sellerName, amount: 0, count: 0 });
    const row = bySeller.get(key);
    row.amount += num(inv.netAmount);
    row.count += 1;
  }
  return {
    taxRate: settings.taxRate,
    rows: progress.rows,
    total: progress.total,
    groupBy,
    cumulative: cumulativeBilling(inPeriod, buckets),
    bySeller: [...bySeller.values()].sort((a, b) => b.amount - a.amount),
    invoices: inPeriod,
  };
}

// -----------------------------------------------------------------------------
// KPI 3 y 4 — Recepcion y cobranza
// -----------------------------------------------------------------------------

export function computeReception({ invoices, period, groupBy = "month" }) {
  const today = todayKey();
  const asOf = asOfKey(period);
  const stats = receptionStats(invoices, period, asOf);
  const buckets = trailingBuckets(asOf, groupBy === "week" ? "week" : "month", 12);
  return {
    asOf,
    groupBy: groupBy === "week" ? "week" : "month",
    ...stats,
    history: pendingReceptionHistory(invoices, buckets, today),
  };
}

export function computeCollection({ invoices, period, settings }) {
  const asOf = asOfKey(period);
  return {
    asOf,
    ...collectionStats(invoices, period, asOf, {
      defaultCreditDays: settings.defaultCreditDays,
      dueSoonDays: settings.dueSoonDays,
    }),
  };
}

// -----------------------------------------------------------------------------
// KPI 5 — Calidad
// -----------------------------------------------------------------------------

export async function computeQuality({ period, settings, catalogs }) {
  const maps = catalogs || (await getCatalogMaps());
  const [errors, rework] = await Promise.all([
    loadQualityErrors(period, maps),
    loadReworkTotals(period),
  ]);
  return {
    laborHourRate: settings.laborHourRate,
    ...qualityStats(errors, {
      laborRate: settings.laborHourRate,
      reworkCount: rework.reworkCount,
      reworkHours: rework.reworkHours,
    }),
  };
}

// -----------------------------------------------------------------------------
// Resumen ejecutivo con comparativo contra el periodo anterior
// -----------------------------------------------------------------------------

export async function computeSummary(period, { date } = {}) {
  const settings = await getKpiSettings();
  const prev = previousPeriod(period);
  const catalogs = await getCatalogMaps();
  const [goals, invoices, commitments, quality, prevQuality] = await Promise.all([
    loadGoals(),
    loadInvoices({ sinceKey: historySinceKey(prev.from) }),
    computeCommitments({ dateKey: date || todayKey(), settings }),
    computeQuality({ period, settings, catalogs }),
    computeQuality({ period: prev, settings, catalogs }),
  ]);

  const sales = computeSales({ goals, invoices, period, settings });
  const prevSales = computeSales({ goals, invoices, period: prev, settings });
  const reception = computeReception({ invoices, period });
  const prevReception = computeReception({ invoices, period: prev });
  const collection = computeCollection({ invoices, period, settings });
  const prevCollection = computeCollection({ invoices, period: prev, settings });

  return {
    period,
    previous: prev,
    settings,
    blocks: {
      commitments: {
        weekNumber: commitments.weekNumber,
        overdue: commitments.counts.overdue,
        thisWeek: commitments.counts.thisWeek,
        nextWeek: commitments.counts.nextWeek,
        upcoming: commitments.counts.upcoming,
        inProgress: commitments.counts.inProgress,
        pending: commitments.counts.pending,
        stopped: commitments.counts.stopped,
      },
      sales: {
        goal: sales.total.goalWithTax,
        billed: sales.total.billedWithTax,
        percent: sales.total.percent,
        difference: sales.total.differenceWithTax,
        compare: {
          billed: delta(sales.total.billedWithTax, prevSales.total.billedWithTax),
          percent: delta(sales.total.percent, prevSales.total.percent),
        },
      },
      reception: {
        pendingAmount: reception.pendingAmount,
        pendingCount: reception.pendingCount,
        avgDays: reception.avgReceptionDays,
        compare: {
          pendingAmount: delta(reception.pendingAmount, prevReception.pendingAmount),
          avgDays: delta(reception.avgReceptionDays, prevReception.avgReceptionDays),
        },
      },
      collection: {
        overdueAmount: collection.overdueAmount,
        overdueCount: collection.overdueCount,
        overdueClients: collection.overdueClients,
        avgInvoiceToPayment: collection.avgInvoiceToPayment,
        avgReceptionToPayment: collection.avgReceptionToPayment,
        dueSoonCount: collection.dueSoonCount,
        compare: {
          overdueAmount: delta(collection.overdueAmount, prevCollection.overdueAmount),
          avgReceptionToPayment: delta(
            collection.avgReceptionToPayment,
            prevCollection.avgReceptionToPayment
          ),
          avgInvoiceToPayment: delta(collection.avgInvoiceToPayment, prevCollection.avgInvoiceToPayment),
        },
      },
      quality: {
        errors: quality.totalErrors,
        internal: quality.internalErrors,
        detectedByQuality: quality.detectedByQuality,
        escapes: quality.escapes,
        reworks: quality.reworkCount,
        reworkHours: quality.reworkHours,
        cost: quality.totalCost,
        compare: {
          errors: delta(quality.totalErrors, prevQuality.totalErrors),
          reworks: delta(quality.reworkCount, prevQuality.reworkCount),
          reworkHours: delta(quality.reworkHours, prevQuality.reworkHours),
          cost: delta(quality.totalCost, prevQuality.totalCost),
          escapes: delta(quality.escapes, prevQuality.escapes),
        },
      },
    },
  };
}

// -----------------------------------------------------------------------------
// Route handlers
// -----------------------------------------------------------------------------

export async function getSummaryHandler(request) {
  await requirePermission("kpis.view");
  const date = new URL(request.url).searchParams.get("date");
  return jsonOk(await computeSummary(periodFromRequest(request), { date }));
}

export async function getCommitmentsHandler(request) {
  await requirePermission("kpis.view");
  const url = new URL(request.url);
  const settings = await getKpiSettings();
  const data = await computeCommitments({ dateKey: url.searchParams.get("date"), settings });
  const catalogs = await getCatalogMaps();
  return jsonOk({
    ...data,
    stopReasons: Object.values(catalogs.STOP_REASON)
      .filter((r) => r.status === "ACTIVE")
      .sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export async function getSalesHandler(request) {
  await requirePermission("kpis.view");
  const period = periodFromRequest(request);
  const settings = await getKpiSettings();
  const prev = previousPeriod(period);
  const [goals, invoices] = await Promise.all([
    loadGoals(),
    loadInvoices({ sinceKey: historySinceKey(prev.from) }),
  ]);
  const current = computeSales({ goals, invoices, period, settings });
  const previous = computeSales({ goals, invoices, period: prev, settings });
  return jsonOk({
    period,
    previous: { ...prev, total: previous.total },
    ...current,
    compare: delta(current.total.billedWithTax, previous.total.billedWithTax),
  });
}

export async function getReceptionHandler(request) {
  await requirePermission("kpis.view");
  const period = periodFromRequest(request);
  const groupBy = new URL(request.url).searchParams.get("groupBy") || "month";
  const prev = previousPeriod(period);
  const invoices = await loadInvoices({ sinceKey: historySinceKey(prev.from) });
  const current = computeReception({ invoices, period, groupBy });
  const previous = computeReception({ invoices, period: prev, groupBy });
  return jsonOk({
    period,
    ...current,
    compare: {
      avgDays: delta(current.avgReceptionDays, previous.avgReceptionDays),
      pendingAmount: delta(current.pendingAmount, previous.pendingAmount),
    },
  });
}

export async function getCollectionHandler(request) {
  await requirePermission("kpis.view");
  const period = periodFromRequest(request);
  const settings = await getKpiSettings();
  const prev = previousPeriod(period);
  const invoices = await loadInvoices({ sinceKey: historySinceKey(prev.from) });
  const current = computeCollection({ invoices, period, settings });
  const previous = computeCollection({ invoices, period: prev, settings });
  return jsonOk({
    period,
    defaultCreditDays: settings.defaultCreditDays,
    dueSoonDays: settings.dueSoonDays,
    ...current,
    compare: {
      overdueAmount: delta(current.overdueAmount, previous.overdueAmount),
      avgInvoiceToPayment: delta(current.avgInvoiceToPayment, previous.avgInvoiceToPayment),
      avgReceptionToPayment: delta(current.avgReceptionToPayment, previous.avgReceptionToPayment),
    },
  });
}

export async function getQualityHandler(request) {
  await requirePermission("kpis.view");
  const period = periodFromRequest(request);
  const settings = await getKpiSettings();
  const catalogs = await getCatalogMaps();
  const prev = previousPeriod(period);
  const [current, previous] = await Promise.all([
    computeQuality({ period, settings, catalogs }),
    computeQuality({ period: prev, settings, catalogs }),
  ]);
  return jsonOk({
    period,
    previous: prev,
    ...current,
    compare: {
      errors: delta(current.totalErrors, previous.totalErrors),
      escapes: delta(current.escapes, previous.escapes),
      reworks: delta(current.reworkCount, previous.reworkCount),
      reworkHours: delta(current.reworkHours, previous.reworkHours),
      cost: delta(current.totalCost, previous.totalCost),
    },
  });
}
