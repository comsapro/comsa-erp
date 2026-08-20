export function quotedHoursFromManufacturing(row = {}) {
  if (String(row.unitSnapshot || "").toUpperCase() === "HOUR") {
    return Number(row.quantity) || 0;
  }
  return 0;
}

export function activeProcesses(processes = []) {
  return processes.filter((p) => p.status !== "REPLACED");
}

function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

export function itemHoursSummary(processes = []) {
  const active = activeProcesses(processes);
  const quotedHours = active.reduce((sum, p) => sum + Number(p.quotedHours || 0), 0);
  const expectedHours = active.reduce(
    (sum, p) => sum + Number(p.expectedHours || 0),
    0
  );
  const realHours = active.reduce((sum, p) => sum + Number(p.realHours || 0), 0);
  return {
    quotedHours: round3(quotedHours),
    expectedHours: round3(expectedHours),
    realHours: round3(realHours),
    difference: round3(realHours - quotedHours),
    differenceExpected: round3(realHours - expectedHours),
  };
}

export function allActiveProcessesCompleted(processes = []) {
  const active = activeProcesses(processes);
  if (!active.length) return true;
  return active.every((p) => p.status === "COMPLETED");
}

export function canDeleteProductionProcess(process) {
  if (!process) return false;
  if (process.sourceType !== "PRODUCTION") return false;
  if (process.status === "COMPLETED" || process.status === "REPLACED") {
    return false;
  }
  if (Number(process.realHours) > 0) return false;
  if (Array.isArray(process.sessions) && process.sessions.length > 0) return false;
  return true;
}

export function sessionElapsedMinutes(session, now = new Date()) {
  if (!session) return 0;
  const accumulated = Number(session.accumulatedMinutes) || 0;
  if (session.status === "RUNNING") {
    const from = new Date(session.lastResumedAt || session.startedAt);
    const extra = Math.max(0, (now.getTime() - from.getTime()) / 60000);
    return accumulated + extra;
  }
  return Number(session.durationMinutes) || accumulated;
}

export function sessionsHours(sessions = [], now = new Date()) {
  const minutes = sessions.reduce(
    (sum, s) => sum + sessionElapsedMinutes(s, now),
    0
  );
  return round3(minutes / 60);
}

export function effectiveRealHours(process = {}, now = new Date()) {
  const sessions = process.sessions || [];
  const fromSessions = sessionsHours(sessions, now);
  if (fromSessions > 0) return fromSessions;
  return round3(process.realHours);
}

export function hoursTone({ expectedHours, realHours }) {
  const expected = Number(expectedHours) || 0;
  const real = Number(realHours) || 0;
  if (expected <= 0) return "neutral";
  if (real <= expected) return "success";
  if (real <= expected * 1.15) return "warning";
  return "danger";
}

// El control dimensional tiene cuatro renglones de operador: se ordenan del responsable
// de la partida hacia quien solo registro tiempo, sin repetir nombres.
export function operatorNames(item = {}, sessionNames = [], limit = 4) {
  const names = [];
  const push = (value) => {
    const name = String(value || "").trim();
    if (name && !names.includes(name)) names.push(name);
  };
  push(item.assignedToUser?.name);
  for (const process of activeProcesses(item.processes || [])) {
    push(process.assignedToUser?.name);
  }
  for (const name of sessionNames) push(name);
  push(item.completedByUser?.name);
  return names.slice(0, limit);
}

export function workOrderProcessSections(processes = []) {
  return activeProcesses(processes).map((p, index) => ({
    index: index + 1,
    name: p.processNameSnapshot || p.process?.name || `Proceso ${index + 1}`,
    sourceType: p.sourceType,
    quotedHours: Number(p.quotedHours) || 0,
    expectedHours: Number(p.expectedHours) || 0,
    realHours: Number(p.realHours) || 0,
    notes: p.notes || "",
    status: p.status,
    assignedTo: p.assignedToUser?.name || null,
    startedAt: p.startedAt || null,
    completedAt: p.completedAt || null,
  }));
}
