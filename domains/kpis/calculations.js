// Calculos puros de KPIs (sin acceso a BD). Reciben filas planas ya leidas y
// devuelven estructuras listas para la UI, el Excel y el PDF.

import {
  DONE_TRACKING_STATUSES,
  OPEN_INCIDENT_STATUSES,
  UNCLASSIFIED,
  UNCLASSIFIED_LABEL,
} from "./constants.js";
import {
  addDaysKey,
  dayKey,
  diffDays,
  inRange,
  maxKey,
  minKey,
  overlapDays,
  rangeDays,
  weekRange,
} from "./periods.js";

export function num(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((Number(value) || 0) * f) / f;
}

export function average(values) {
  const list = values.filter((v) => v != null && Number.isFinite(v));
  if (!list.length) return null;
  return round(list.reduce((a, b) => a + b, 0) / list.length, 1);
}

export function percent(part, whole, decimals = 1) {
  const w = num(whole);
  if (w <= 0) return null;
  return round((num(part) / w) * 100, decimals);
}

/** Variacion actual vs anterior. */
export function delta(current, previous) {
  const c = current == null ? null : num(current);
  const p = previous == null ? null : num(previous);
  if (c == null || p == null) return { current: c, previous: p, diff: null, pct: null };
  return {
    current: c,
    previous: p,
    diff: round(c - p, 2),
    pct: p !== 0 ? round(((c - p) / Math.abs(p)) * 100, 1) : null,
  };
}

// -----------------------------------------------------------------------------
// KPI 1 — Seguimiento de trabajos y compromisos
// -----------------------------------------------------------------------------

function qualityReleased(quality) {
  if (!quality) return false;
  if (quality.inspectionStatus === "CLOSED") return true;
  const requested = num(quality.requestedQty);
  return requested > 0 && num(quality.releasedQty) >= requested;
}

/**
 * Estatus operativo de una partida.
 * Prioridad: entregado > detenido (incidencia bloqueante abierta) > manual >
 * derivado de produccion/calidad. Si el compromiso ya paso y no esta
 * terminado se muestra como Retrasado (conservando baseStatus).
 */
export function resolveTrackingStatus(item, today) {
  const commitment = dayKey(item.commitmentDate);
  const delivered = item.trackingStatus === "DELIVERED" || Boolean(item.deliveredAt);
  let base;
  if (delivered) {
    base = "DELIVERED";
  } else if ((item.openBlockingIncidents || 0) > 0) {
    base = "STOPPED";
  } else if (item.trackingStatus && !["DELAYED", "STOPPED"].includes(item.trackingStatus)) {
    base = item.trackingStatus;
  } else if (item.status === "COMPLETED") {
    if (qualityReleased(item.quality)) base = "RELEASED";
    else if (item.quality && item.quality.inspectionStatus !== "CLOSED") base = "IN_QUALITY";
    else base = "FINISHED";
  } else if (item.status === "IN_PROGRESS" || item.status === "REWORK") {
    base = "IN_PRODUCTION";
  } else {
    base = "PENDING";
  }

  const done = DONE_TRACKING_STATUSES.includes(base);
  const overdue = Boolean(commitment && today && commitment < today && !done);
  const daysLate = overdue ? diffDays(commitment, today) : 0;
  const status = overdue && base !== "STOPPED" ? "DELAYED" : base;
  return { status, baseStatus: base, overdue, daysLate, done };
}

/**
 * Clasifica partidas para la vista de junta respecto a la semana de referencia.
 * rows: [{ ...item, tracking: resolveTrackingStatus(...) }]
 */
export function classifyCommitments(rows, { today, weekKey, upcomingDays = 7 }) {
  const week = weekRange(weekKey || today);
  const lastWeek = { from: addDaysKey(week.from, -7), to: addDaysKey(week.from, -1) };
  const nextWeek = { from: addDaysKey(week.to, 1), to: addDaysKey(week.to, 7) };
  const upcoming = { from: addDaysKey(today, 1), to: addDaysKey(today, upcomingDays) };

  const groups = {
    overdue: [],
    thisWeek: [],
    lastWeek: [],
    nextWeek: [],
    upcoming: [],
    inProgress: [],
    pending: [],
    stopped: [],
  };

  for (const row of rows) {
    const commitment = dayKey(row.commitmentDate);
    const t = row.tracking;
    if (t.overdue) groups.overdue.push(row);
    if (inRange(commitment, week)) groups.thisWeek.push(row);
    if (inRange(commitment, lastWeek)) groups.lastWeek.push(row);
    if (inRange(commitment, nextWeek)) groups.nextWeek.push(row);
    if (!t.done && inRange(commitment, upcoming)) groups.upcoming.push(row);
    if (t.baseStatus === "STOPPED") groups.stopped.push(row);
    if (["IN_PRODUCTION", "IN_QUALITY"].includes(t.baseStatus)) groups.inProgress.push(row);
    if (t.baseStatus === "PENDING") groups.pending.push(row);
  }

  const byCommitment = (a, b) =>
    String(dayKey(a.commitmentDate) || "9999").localeCompare(String(dayKey(b.commitmentDate) || "9999"));
  for (const list of Object.values(groups)) list.sort(byCommitment);

  return {
    week,
    lastWeek,
    nextWeek,
    upcoming,
    groups,
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  };
}

// -----------------------------------------------------------------------------
// KPI 2 — Proyeccion y avance de ventas
// -----------------------------------------------------------------------------

const GRANULARITY_ORDER = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

/** Rango (llaves) de una meta segun su periodo y periodKey. */
export function goalRange(period, periodKey) {
  const pad = (n) => String(n).padStart(2, "0");
  const monthEnd = (y, m) => `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  if (period === "MONTHLY") {
    const [y, m] = periodKey.split("-").map(Number);
    return { from: `${y}-${pad(m)}-01`, to: monthEnd(y, m) };
  }
  if (period === "QUARTERLY") {
    const [y, q] = periodKey.split("-");
    const start = (Number(String(q).replace("Q", "")) - 1) * 3 + 1;
    return { from: `${y}-${pad(start)}-01`, to: monthEnd(Number(y), start + 2) };
  }
  if (period === "SEMIANNUAL") {
    const [y, h] = periodKey.split("-");
    const start = String(h).replace("H", "") === "1" ? 1 : 7;
    return { from: `${y}-${pad(start)}-01`, to: monthEnd(Number(y), start + 5) };
  }
  const y = Number(periodKey);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function withTax(amount, taxRate) {
  return round(num(amount) * (1 + num(taxRate) / 100), 2);
}

export function withoutTax(amount, taxRate) {
  return round(num(amount) / (1 + num(taxRate) / 100), 2);
}

/** Monto de la meta expresado con IVA. */
export function goalAmountWithTax(goal, taxRate) {
  return goal.amountIncludesTax === false ? withTax(goal.amount, taxRate) : round(num(goal.amount), 2);
}

function assigneeKey(goal) {
  const teams = [...(goal.teamIds || [])].sort();
  const sellers = [...(goal.sellerIds || [])].sort();
  return `t:${teams.join(",")}|s:${sellers.join(",")}`;
}

/**
 * Meta aplicable a un rango por grupo de asignacion (equipo/vendedores).
 * Para cada grupo se usa la granularidad mas fina que traslapa el rango y se
 * prorratea por dias (p. ej. semana = meta mensual × 7/30).
 *
 * goals: [{ id, period, periodKey, amount, amountIncludesTax, label,
 *           teamIds, sellerIds, memberIds, names }]
 */
export function goalTargetsForRange(goals, range, taxRate) {
  const groups = new Map();
  for (const goal of goals) {
    const gr = goalRange(goal.period, goal.periodKey);
    const days = overlapDays(gr, range);
    if (days <= 0) continue;
    const key = assigneeKey(goal);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ goal, days, goalDays: rangeDays(gr) });
  }

  const targets = [];
  for (const [key, list] of groups) {
    const finest = GRANULARITY_ORDER.find((g) => list.some((x) => x.goal.period === g));
    const chosen = list.filter((x) => x.goal.period === finest);
    const amount = chosen.reduce(
      (sum, x) => sum + (goalAmountWithTax(x.goal, taxRate) * x.days) / x.goalDays,
      0
    );
    const first = chosen[0].goal;
    const memberIds = [...new Set(chosen.flatMap((x) => x.goal.memberIds || []))];
    const teamIds = [...new Set(chosen.flatMap((x) => x.goal.teamIds || []))];
    targets.push({
      key,
      label: first.label || first.names || "Meta",
      granularity: finest,
      prorated: chosen.some((x) => x.days < x.goalDays),
      goalIds: chosen.map((x) => x.goal.id),
      memberIds,
      teamIds,
      goalWithTax: round(amount, 2),
    });
  }
  targets.sort((a, b) => b.goalWithTax - a.goalWithTax);
  return targets;
}

/**
 * Avance de facturacion contra meta.
 * invoices: [{ sellerId, sellerName, netAmount (con IVA) }]
 */
export function salesProgress(targets, invoices, taxRate) {
  // Una factura cuenta para la meta si su vendedor es integrante o si se
  // acredito al equipo de la meta.
  const assigned = new Set();
  const assignedTeams = new Set();
  const rows = targets.map((t) => {
    const members = new Set(t.memberIds);
    const teams = new Set(t.teamIds || []);
    const billed = invoices
      .filter((inv) => members.has(inv.sellerId) || (inv.teamId && teams.has(inv.teamId)))
      .reduce((s, inv) => s + num(inv.netAmount), 0);
    t.memberIds.forEach((id) => assigned.add(id));
    teams.forEach((id) => assignedTeams.add(id));
    return buildSalesRow({
      key: t.key,
      label: t.label,
      goal: t.goalWithTax,
      billed,
      taxRate,
      prorated: t.prorated,
      granularity: t.granularity,
      memberIds: t.memberIds,
    });
  });

  const unassignedInvoices = invoices.filter(
    (inv) => !assigned.has(inv.sellerId) && !(inv.teamId && assignedTeams.has(inv.teamId))
  );
  if (unassignedInvoices.length) {
    const billed = unassignedInvoices.reduce((s, inv) => s + num(inv.netAmount), 0);
    const names = [...new Set(unassignedInvoices.map((i) => i.sellerName).filter(Boolean))];
    rows.push(
      buildSalesRow({
        key: "__unassigned__",
        label: `Sin meta asignada${names.length ? ` (${names.join(", ")})` : ""}`,
        goal: 0,
        billed,
        taxRate,
        unassigned: true,
      })
    );
  }

  const totalGoal = targets.reduce((s, t) => s + t.goalWithTax, 0);
  const totalBilled = invoices.reduce((s, inv) => s + num(inv.netAmount), 0);
  const total = buildSalesRow({ key: "__total__", label: "Total", goal: totalGoal, billed: totalBilled, taxRate });
  return { rows, total };
}

function buildSalesRow({ key, label, goal, billed, taxRate, ...rest }) {
  return {
    key,
    label,
    goalWithTax: round(goal, 2),
    goalWithoutTax: withoutTax(goal, taxRate),
    billedWithTax: round(billed, 2),
    billedWithoutTax: withoutTax(billed, taxRate),
    percent: percent(billed, goal),
    differenceWithTax: round(billed - goal, 2),
    ...rest,
  };
}

/** Facturacion acumulada por bucket (para la grafica de avance). */
export function cumulativeBilling(invoices, buckets) {
  let acc = 0;
  return buckets.map((b) => {
    const amount = invoices
      .filter((inv) => inRange(dayKey(inv.invoiceDate), b))
      .reduce((s, inv) => s + num(inv.netAmount), 0);
    acc += amount;
    return { key: b.key, label: b.label, amount: round(amount), cumulative: round(acc) };
  });
}

// -----------------------------------------------------------------------------
// KPI 3 — Facturas pendientes de recepcion
// -----------------------------------------------------------------------------

/** Fecha desde la que se mide la recepcion: envio o, en su defecto, factura. */
export function receptionStartKey(inv) {
  return dayKey(inv.sentAt) || dayKey(inv.invoiceDate);
}

export function isPendingReceptionAt(inv, asOf) {
  const invoiceKey = dayKey(inv.invoiceDate);
  if (!invoiceKey || invoiceKey > asOf) return false;
  const reception = dayKey(inv.receptionDate);
  return !reception || reception > asOf;
}

export function receptionStats(invoices, range, asOf) {
  const pending = invoices
    .filter((inv) => isPendingReceptionAt(inv, asOf))
    .map((inv) => ({ ...inv, daysPending: Math.max(0, diffDays(receptionStartKey(inv), asOf) ?? 0) }))
    .sort((a, b) => b.daysPending - a.daysPending);

  const received = invoices
    .filter((inv) => inRange(dayKey(inv.receptionDate), range))
    .map((inv) => ({
      ...inv,
      receptionDays: Math.max(0, diffDays(receptionStartKey(inv), dayKey(inv.receptionDate)) ?? 0),
    }))
    .sort((a, b) => String(dayKey(a.receptionDate)).localeCompare(String(dayKey(b.receptionDate))));

  const byClient = distribution(
    pending,
    (inv) => inv.clientId || UNCLASSIFIED,
    (inv) => inv.clientName || "Sin cliente",
    (inv) => num(inv.netAmount)
  );

  return {
    pendingCount: pending.length,
    pendingAmount: round(pending.reduce((s, inv) => s + num(inv.netAmount), 0)),
    avgReceptionDays: average(received.map((r) => r.receptionDays)),
    receivedCount: received.length,
    pending,
    received,
    byClient,
  };
}

/** Monto pendiente de recepcion al cierre de cada bucket. */
export function pendingReceptionHistory(invoices, buckets, today) {
  return buckets.map((b) => {
    const cut = minKey(b.to, today);
    const pending = invoices.filter((inv) => isPendingReceptionAt(inv, cut));
    return {
      key: b.key,
      label: b.label,
      amount: round(pending.reduce((s, inv) => s + num(inv.netAmount), 0)),
      count: pending.length,
      future: b.from > today,
    };
  });
}

// -----------------------------------------------------------------------------
// KPI 4 — Cobranza y tiempo de credito
// -----------------------------------------------------------------------------

export function dueDateKey(inv, defaultCreditDays = 30) {
  const stored = dayKey(inv.dueDate);
  if (stored) return stored;
  const reception = dayKey(inv.receptionDate);
  if (!reception) return null;
  const days = inv.creditDays == null ? defaultCreditDays : Number(inv.creditDays);
  return addDaysKey(reception, Number.isFinite(days) ? days : defaultCreditDays);
}

export function collectionStats(invoices, range, asOf, { defaultCreditDays = 30, dueSoonDays = 7 } = {}) {
  const rows = invoices.map((inv) => ({
    ...inv,
    dueKey: dueDateKey(inv, defaultCreditDays),
    paidKey: dayKey(inv.paidAt),
    receptionKey: dayKey(inv.receptionDate),
    invoiceKey: dayKey(inv.invoiceDate),
  }));

  const unpaidAt = (r, cut) => !r.paidKey || r.paidKey > cut;

  const overdue = rows
    .filter((r) => r.receptionKey && r.receptionKey <= asOf && r.dueKey && r.dueKey < asOf && unpaidAt(r, asOf))
    .map((r) => ({ ...r, daysOverdue: diffDays(r.dueKey, asOf), paidLate: false }));

  const paidLate = rows
    .filter((r) => r.paidKey && inRange(r.paidKey, range) && r.dueKey && r.paidKey > r.dueKey)
    .map((r) => ({ ...r, daysOverdue: diffDays(r.dueKey, r.paidKey), paidLate: true }));

  const dueSoonLimit = addDaysKey(asOf, dueSoonDays);
  const dueSoon = rows
    .filter((r) => r.receptionKey && r.dueKey && r.dueKey >= asOf && r.dueKey <= dueSoonLimit && unpaidAt(r, asOf))
    .map((r) => ({ ...r, daysToDue: diffDays(asOf, r.dueKey) }))
    .sort((a, b) => a.daysToDue - b.daysToDue);

  const paidInRange = rows.filter((r) => r.paidKey && inRange(r.paidKey, range));
  const avgInvoiceToPayment = average(
    paidInRange.map((r) => (r.invoiceKey ? Math.max(0, diffDays(r.invoiceKey, r.paidKey)) : null))
  );
  const avgReceptionToPayment = average(
    paidInRange.map((r) => (r.receptionKey ? Math.max(0, diffDays(r.receptionKey, r.paidKey)) : null))
  );

  const outstanding = rows.filter(
    (r) => r.invoiceKey && r.invoiceKey <= asOf && unpaidAt(r, asOf)
  );

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  const distributionByClient = distribution(
    overdue,
    (r) => r.clientId || UNCLASSIFIED,
    (r) => r.clientName || "Sin cliente",
    (r) => num(r.netAmount)
  );

  return {
    overdueAmount: round(overdue.reduce((s, r) => s + num(r.netAmount), 0)),
    overdueCount: overdue.length,
    overdueClients: distributionByClient.length,
    dueSoonAmount: round(dueSoon.reduce((s, r) => s + num(r.netAmount), 0)),
    dueSoonCount: dueSoon.length,
    outstandingAmount: round(outstanding.reduce((s, r) => s + num(r.netAmount), 0)),
    paidCount: paidInRange.length,
    paidAmount: round(paidInRange.reduce((s, r) => s + num(r.netAmount), 0)),
    avgInvoiceToPayment,
    avgReceptionToPayment,
    overdue,
    paidLate: paidLate.sort((a, b) => b.daysOverdue - a.daysOverdue),
    dueSoon,
    distributionByClient,
  };
}

// -----------------------------------------------------------------------------
// KPI 5 — Calidad y errores de produccion
// -----------------------------------------------------------------------------

/**
 * Costo de un error. Las horas del retrabajo ligado se suman como mano de
 * obra de retrabajo solo si no se capturo manualmente una linea REWORK, para
 * no duplicar.
 */
export function errorCost(error, laborRate = 0) {
  let labor = 0;
  let material = 0;
  let other = 0;
  let hours = 0;
  let hasManualRework = false;

  for (const line of error.costs || []) {
    if (line.category === "LABOR") {
      const h = num(line.hours);
      const rate = line.hourlyRate == null ? num(laborRate) : num(line.hourlyRate);
      labor += h > 0 ? h * rate : num(line.amount);
      hours += h;
      if (line.concept === "REWORK") hasManualRework = true;
    } else if (line.category === "MATERIAL") {
      material += num(line.amount);
    } else {
      other += num(line.amount);
    }
  }

  const linkedHours = num(error.linkedReworkHours);
  if (linkedHours > 0 && !hasManualRework) {
    labor += linkedHours * num(laborRate);
    hours += linkedHours;
  }

  return {
    labor: round(labor),
    material: round(material),
    other: round(other),
    total: round(labor + material + other),
    hours: round(hours, 2),
  };
}

/** Distribucion generica [{ key, label, count, amount, pct, amountPct }]. */
export function distribution(rows, keyFn, labelFn, amountFn = () => 0) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || UNCLASSIFIED;
    if (!map.has(key)) map.set(key, { key, label: labelFn(row) || UNCLASSIFIED_LABEL, count: 0, amount: 0 });
    const entry = map.get(key);
    entry.count += 1;
    entry.amount += amountFn(row);
  }
  const totalCount = rows.length;
  const totalAmount = [...map.values()].reduce((s, e) => s + e.amount, 0);
  return [...map.values()]
    .map((e) => ({
      ...e,
      amount: round(e.amount),
      pct: totalCount ? round((e.count / totalCount) * 100, 1) : 0,
      amountPct: totalAmount ? round((e.amount / totalAmount) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
}

/**
 * errors: [{ ...QualityError, costs, linkedReworkHours, causeLabel, areaLabel, operatorLabel }]
 */
export function qualityStats(errors, { laborRate = 0, reworkCount = 0, reworkHours = 0 } = {}) {
  const enriched = errors.map((e) => ({ ...e, cost: errorCost(e, laborRate) }));
  const byStage = { PRODUCTION: 0, QUALITY: 0, CLIENT: 0 };
  for (const e of enriched) byStage[e.detectionStage] = (byStage[e.detectionStage] || 0) + 1;

  const totalCost = enriched.reduce((s, e) => s + e.cost.total, 0);
  const costBreakdown = enriched.reduce(
    (acc, e) => ({
      labor: acc.labor + e.cost.labor,
      material: acc.material + e.cost.material,
      other: acc.other + e.cost.other,
    }),
    { labor: 0, material: 0, other: 0 }
  );

  const sortByCount = (list) => [...list].sort((a, b) => b.count - a.count || b.amount - a.amount);

  return {
    totalErrors: enriched.length,
    internalErrors: byStage.PRODUCTION + byStage.QUALITY,
    detectedByProduction: byStage.PRODUCTION,
    detectedByQuality: byStage.QUALITY,
    escapes: byStage.CLIENT,
    qualityEffectiveness: percent(byStage.QUALITY + byStage.PRODUCTION, enriched.length),
    reworkCount,
    reworkHours: round(reworkHours, 2),
    errorHours: round(enriched.reduce((s, e) => s + e.cost.hours, 0), 2),
    totalCost: round(totalCost),
    costBreakdown: {
      labor: round(costBreakdown.labor),
      material: round(costBreakdown.material),
      other: round(costBreakdown.other),
    },
    unclassified: enriched.filter((e) => !e.causeCode || !e.areaCode).length,
    byArea: sortByCount(
      distribution(enriched, (e) => e.areaCode, (e) => e.areaLabel, (e) => e.cost.total)
    ),
    byCause: sortByCount(
      distribution(enriched, (e) => e.causeCode, (e) => e.causeLabel, (e) => e.cost.total)
    ),
    byOperator: sortByCount(
      distribution(
        enriched,
        (e) => e.operatorUserId || (e.operatorName ? `name:${e.operatorName.trim().toLowerCase()}` : null),
        (e) => e.operatorLabel,
        (e) => e.cost.total
      )
    ),
    errors: enriched.sort((a, b) => b.cost.total - a.cost.total),
  };
}

/** Coincidencia tolerante de texto libre con un catalogo (codigo o etiqueta). */
export function matchCatalogCode(text, entries = []) {
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  const target = norm(text);
  if (!target) return null;
  const hit = entries.find((e) => norm(e.code) === target || norm(e.label) === target);
  return hit ? hit.code : null;
}

/** Contadores de incidencias abiertas por partida. */
export function openBlockingByItem(incidents = []) {
  const map = new Map();
  for (const inc of incidents) {
    if (!inc.productionItemId || !inc.blocking) continue;
    if (!OPEN_INCIDENT_STATUSES.includes(inc.status)) continue;
    map.set(inc.productionItemId, (map.get(inc.productionItemId) || 0) + 1);
  }
  return map;
}

/** Responsable sugerido segun la regla del catalogo. */
export function suggestResponsible(rule, { sellerId, assigneeId } = {}) {
  if (rule === "SELLER") return sellerId || null;
  if (rule === "ITEM_ASSIGNEE") return assigneeId || null;
  return null;
}

export { maxKey, minKey };
