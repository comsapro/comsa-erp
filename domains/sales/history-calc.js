/**
 * Calculos del historico de ventas (sin dependencias de servidor).
 * monthRows: [{ ym: "2025-03", total, count }]
 */

const round = (n, d = 2) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;

export const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Variacion porcentual; null si no hay base. */
export function growthPct(current, previous) {
  const p = Number(previous) || 0;
  if (p <= 0) return null;
  return round(((Number(current) || 0) - p) / p * 100, 1);
}

/** Matriz anio x mes con totales, conteos y variaciones. */
export function buildHistory(monthRows, { today = new Date() } = {}) {
  const byYear = new Map();
  for (const r of monthRows) {
    const year = Number(r.ym.slice(0, 4));
    const month = Number(r.ym.slice(5, 7));
    if (!byYear.has(year)) {
      byYear.set(year, { year, months: Array.from({ length: 12 }, () => ({ total: 0, count: 0 })) });
    }
    const cell = byYear.get(year).months[month - 1];
    cell.total += Number(r.total) || 0;
    cell.count += Number(r.count) || 0;
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  const rows = years.map((year) => {
    const y = byYear.get(year);
    const prev = byYear.get(year - 1);
    const total = y.months.reduce((s, m) => s + m.total, 0);
    const count = y.months.reduce((s, m) => s + m.count, 0);
    const prevTotal = prev ? prev.months.reduce((s, m) => s + m.total, 0) : null;
    // Anio en curso: se compara contra los mismos meses del anio anterior.
    const partial = year === currentYear;
    const ytdMonths = partial ? currentMonth : 12;
    const ytdPrev = prev ? prev.months.slice(0, ytdMonths).reduce((s, m) => s + m.total, 0) : null;
    const ytd = y.months.slice(0, ytdMonths).reduce((s, m) => s + m.total, 0);
    return {
      year,
      total: round(total),
      count,
      avgTicket: count ? round(total / count) : 0,
      growthPct: partial ? null : growthPct(total, prevTotal),
      partial,
      ytdMonths,
      ytdGrowthPct: prev ? growthPct(ytd, ytdPrev) : null,
      months: y.months.map((m, i) => ({
        month: i + 1,
        total: round(m.total),
        count: m.count,
        yoyPct: prev ? growthPct(m.total, prev.months[i].total) : null,
        momPct:
          i > 0
            ? growthPct(m.total, y.months[i - 1].total)
            : prev
              ? growthPct(m.total, prev.months[11].total)
              : null,
      })),
    };
  });
  return { years: rows };
}

/** Ranking con participacion y variacion contra el anio anterior. */
export function rankWithShare(current = [], previous = [], limit = 15) {
  const prevMap = new Map(previous.map((r) => [r.name, Number(r.total) || 0]));
  const sum = current.reduce((s, r) => s + (Number(r.total) || 0), 0);
  return current
    .map((r) => ({
      name: r.name,
      total: round(r.total),
      count: Number(r.count) || 0,
      sharePct: sum ? round(((Number(r.total) || 0) / sum) * 100, 1) : 0,
      previous: round(prevMap.get(r.name) || 0),
      growthPct: growthPct(r.total, prevMap.get(r.name)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
