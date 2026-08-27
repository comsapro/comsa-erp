/** Utilidades compartidas para Gantt / calendario de produccion. */

export function toDay(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

/**
 * Rango visual de una partida en el tablero.
 * Prioridad: planeado inicio/fin → compromiso → entrega aproximada de la OP.
 */
export function resolveScheduleSpan(item) {
  const orderDelivery = toDay(item.productionOrder?.estimatedDeliveryDate);
  const commitment = toDay(item.commitmentDate);
  const plannedStart = toDay(item.plannedStartAt);
  const plannedEnd = toDay(item.plannedEndAt);

  let start = plannedStart || plannedEnd || commitment || orderDelivery;
  let end = plannedEnd || commitment || orderDelivery || plannedStart || start;

  if (start && end && end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  return {
    start,
    end,
    source: plannedStart || plannedEnd
      ? "planned"
      : commitment
        ? "commitment"
        : orderDelivery
          ? "estimated"
          : null,
  };
}

export function buildDayRange(startIso, endIso, maxDays = 120) {
  if (!startIso || !endIso) return [];
  const days = [];
  let cursor = startIso;
  while (cursor <= endIso && days.length < maxDays) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function defaultAgendaWindow() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: addDays(today, -7),
    to: addDays(today, 45),
  };
}
