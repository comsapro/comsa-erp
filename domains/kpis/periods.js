// Periodos de consulta del Dashboard gerencial. Todo se maneja con "llaves de
// dia" ISO (YYYY-MM-DD) para evitar corrimientos de zona horaria: las columnas
// @db.Date se guardan a medianoche UTC y la operacion de COMSA es en hora del
// centro de Mexico (UTC-6, sin horario de verano desde 2022).

export const BUSINESS_UTC_OFFSET = "-06:00";
const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const PERIOD_TYPES = [
  { key: "month", label: "Mes actual" },
  { key: "prev_month", label: "Mes anterior" },
  { key: "month_pick", label: "Mes específico" },
  { key: "week", label: "Semana" },
  { key: "quarter", label: "Trimestre" },
  { key: "semester", label: "Semestre" },
  { key: "year", label: "Año" },
  { key: "custom", label: "Personalizado" },
];

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, "0");
}

export function isDayKey(value) {
  return typeof value === "string" && KEY_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Llave de dia para "hoy" en hora de negocio. */
export function todayKey(now = new Date()) {
  return new Date(now.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Convierte un valor de BD a llave de dia. Las columnas @db.Date llegan como
 * medianoche UTC, por lo que basta con la parte de fecha ISO.
 */
export function dayKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (KEY_RE.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Llave de dia de un timestamp (instante) en hora de negocio. */
export function timestampDayKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysKey(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias de a -> b (b - a). */
export function diffDays(a, b) {
  if (!a || !b) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function minKey(a, b) {
  return a <= b ? a : b;
}

export function maxKey(a, b) {
  return a >= b ? a : b;
}

export function inRange(key, range) {
  return Boolean(key) && key >= range.from && key <= range.to;
}

/** Dias que se traslapan (inclusivo) entre dos rangos de llaves. */
export function overlapDays(a, b) {
  const from = maxKey(a.from, b.from);
  const to = minKey(a.to, b.to);
  if (from > to) return 0;
  return diffDays(from, to) + 1;
}

export function rangeDays(range) {
  return diffDays(range.from, range.to) + 1;
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRange(year, month) {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  };
}

/** Lunes a domingo de la semana que contiene la llave. */
export function weekRange(key) {
  const d = new Date(`${key}T00:00:00Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const from = addDaysKey(key, diff);
  return { from, to: addDaysKey(from, 6) };
}

/** Numero de semana ISO-8601. */
export function isoWeek(key) {
  const d = new Date(`${key}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function formatDayShort(key) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return `${pad(d)} ${MONTH_SHORT[m - 1]} ${y}`;
}

export function formatDayMonth(key) {
  if (!key) return "—";
  const [, m, d] = key.split("-").map(Number);
  return `${pad(d)}/${pad(m)}`;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max, fallback) {
  const n = toInt(value, fallback);
  return Math.min(max, Math.max(min, n));
}

/**
 * Resuelve el periodo seleccionado a { type, from, to, label, params }.
 * Parametros: period, year, month, quarter, half, from, to, date.
 */
export function resolvePeriod(params = {}, now = new Date()) {
  const today = todayKey(now);
  const [ty, tm] = today.split("-").map(Number);
  const type = PERIOD_TYPES.some((p) => p.key === params.period) ? params.period : "month";
  const year = clampInt(params.year, 2000, 2100, ty);

  if (type === "prev_month") {
    const py = tm === 1 ? ty - 1 : ty;
    const pm = tm === 1 ? 12 : tm - 1;
    return {
      type,
      ...monthRange(py, pm),
      label: `${MONTH_NAMES[pm - 1]} ${py}`,
      params: { period: type },
    };
  }

  if (type === "month_pick") {
    const month = clampInt(params.month, 1, 12, tm);
    return {
      type,
      ...monthRange(year, month),
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      params: { period: type, year, month },
    };
  }

  if (type === "week") {
    const base = isDayKey(params.date) ? params.date : today;
    const range = weekRange(base);
    const { week } = isoWeek(range.from);
    return {
      type,
      ...range,
      label: `Semana ${week} · ${formatDayMonth(range.from)}–${formatDayMonth(range.to)}/${range.to.slice(0, 4)}`,
      week,
      params: { period: type, date: range.from },
    };
  }

  if (type === "quarter") {
    const quarter = clampInt(params.quarter, 1, 4, Math.ceil(tm / 3));
    const startMonth = (quarter - 1) * 3 + 1;
    return {
      type,
      from: monthRange(year, startMonth).from,
      to: monthRange(year, startMonth + 2).to,
      label: `Q${quarter} ${year}`,
      params: { period: type, year, quarter },
    };
  }

  if (type === "semester") {
    const half = clampInt(params.half, 1, 2, tm <= 6 ? 1 : 2);
    const startMonth = half === 1 ? 1 : 7;
    return {
      type,
      from: monthRange(year, startMonth).from,
      to: monthRange(year, startMonth + 5).to,
      label: `H${half} ${year}`,
      params: { period: type, year, half },
    };
  }

  if (type === "year") {
    return {
      type,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: String(year),
      params: { period: type, year },
    };
  }

  if (type === "custom" && isDayKey(params.from) && isDayKey(params.to)) {
    let from = params.from;
    let to = params.to;
    if (from > to) [from, to] = [to, from];
    // Limite defensivo: 3 años.
    if (diffDays(from, to) > 366 * 3) from = addDaysKey(to, -366 * 3);
    return {
      type,
      from,
      to,
      label: `${formatDayShort(from)} – ${formatDayShort(to)}`,
      params: { period: type, from, to },
    };
  }

  return {
    type: "month",
    ...monthRange(ty, tm),
    label: `${MONTH_NAMES[tm - 1]} ${ty}`,
    params: { period: "month" },
  };
}

/** Periodo inmediato anterior equivalente (para comparativos). */
export function previousPeriod(period) {
  const [fy, fm] = period.from.split("-").map(Number);
  const shiftMonths = (months) => {
    let y = fy;
    let m = fm - months;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    return { y, m };
  };

  if (period.type === "month" || period.type === "prev_month" || period.type === "month_pick") {
    const { y, m } = shiftMonths(1);
    return { type: "month_pick", ...monthRange(y, m), label: `${MONTH_NAMES[m - 1]} ${y}` };
  }
  if (period.type === "quarter") {
    const { y, m } = shiftMonths(3);
    return {
      type: "quarter",
      from: monthRange(y, m).from,
      to: monthRange(y, m + 2).to,
      label: `Q${Math.ceil(m / 3)} ${y}`,
    };
  }
  if (period.type === "semester") {
    const { y, m } = shiftMonths(6);
    return {
      type: "semester",
      from: monthRange(y, m).from,
      to: monthRange(y, m + 5).to,
      label: `H${m <= 6 ? 1 : 2} ${y}`,
    };
  }
  if (period.type === "year") {
    return { type: "year", from: `${fy - 1}-01-01`, to: `${fy - 1}-12-31`, label: String(fy - 1) };
  }
  if (period.type === "week") {
    const from = addDaysKey(period.from, -7);
    const { week } = isoWeek(from);
    return { type: "week", from, to: addDaysKey(from, 6), label: `Semana ${week}` };
  }
  const days = rangeDays(period);
  const to = addDaysKey(period.from, -1);
  const from = addDaysKey(to, -(days - 1));
  return { type: "custom", from, to, label: `${formatDayShort(from)} – ${formatDayShort(to)}` };
}

/** Fecha de corte para indicadores "al dia": fin del periodo o hoy si aun no termina. */
export function asOfKey(period, now = new Date()) {
  return minKey(period.to, todayKey(now));
}

/** Particiona [from, to] en semanas (lun-dom) o meses. */
export function buildBuckets(from, to, groupBy = "month") {
  const buckets = [];
  if (!from || !to || from > to) return buckets;
  if (groupBy === "week") {
    let cursor = weekRange(from).from;
    while (cursor <= to && buckets.length < 160) {
      const end = addDaysKey(cursor, 6);
      const { week } = isoWeek(cursor);
      buckets.push({ key: cursor, label: `S${week}`, from: cursor, to: end });
      cursor = addDaysKey(cursor, 7);
    }
    return buckets;
  }
  let [y, m] = from.split("-").map(Number);
  while (buckets.length < 120) {
    const range = monthRange(y, m);
    if (range.from > to) break;
    buckets.push({
      key: range.from.slice(0, 7),
      label: `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`,
      ...range,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return buckets;
}

/** Ultimos N buckets que terminan en la llave indicada. */
export function trailingBuckets(endKey, groupBy = "month", count = 12) {
  if (groupBy === "week") {
    const lastWeek = weekRange(endKey).from;
    return buildBuckets(addDaysKey(lastWeek, -7 * (count - 1)), endKey, "week");
  }
  let [y, m] = endKey.split("-").map(Number);
  m -= count - 1;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return buildBuckets(`${y}-${pad(m)}-01`, endKey, "month");
}

/** Limites para consultas Prisma sobre columnas @db.Date. */
export function dateColumnBounds(range) {
  return {
    gte: new Date(`${range.from}T00:00:00.000Z`),
    lte: new Date(`${range.to}T00:00:00.000Z`),
  };
}

/** Limites para consultas Prisma sobre timestamps (hora de negocio). */
export function timestampBounds(range) {
  return {
    gte: new Date(`${range.from}T00:00:00.000${BUSINESS_UTC_OFFSET}`),
    lte: new Date(`${range.to}T23:59:59.999${BUSINESS_UTC_OFFSET}`),
  };
}

export function keyToDate(key) {
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

/** Serializa el periodo a parametros de URL. */
export function periodQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  return search.toString();
}

/** Lee los parametros de periodo desde URLSearchParams u objeto plano. */
export function readPeriodParams(source) {
  const get = (k) => {
    if (!source) return undefined;
    if (typeof source.get === "function") return source.get(k) ?? undefined;
    const v = source[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    period: get("period"),
    year: get("year"),
    month: get("month"),
    quarter: get("quarter"),
    half: get("half"),
    from: get("from"),
    to: get("to"),
    date: get("date"),
  };
}
