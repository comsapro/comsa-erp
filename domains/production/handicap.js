export function clampHandicapPercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(90, Math.max(0, n));
}

export function expectedHoursFromQuoted(quotedHours, handicapPercent = 0) {
  const quoted = Number(quotedHours) || 0;
  const handicap = clampHandicapPercent(handicapPercent);
  const expected = quoted * (1 - handicap / 100);
  return Math.round(expected * 1000) / 1000;
}

export function hoursEfficiency(quotedHours, expectedHours, realHours) {
  const real = Number(realHours) || 0;
  const expected = Number(expectedHours) || 0;
  const quoted = Number(quotedHours) || 0;
  const vsQuoted = quoted > 0 ? Math.round(((quoted - real) / quoted) * 1000) / 10 : null;
  const vsExpected =
    expected > 0 ? Math.round(((expected - real) / expected) * 1000) / 10 : null;
  return {
    quotedHours: Math.round(quoted * 1000) / 1000,
    expectedHours: Math.round(expected * 1000) / 1000,
    realHours: Math.round(real * 1000) / 1000,
    diffQuoted: Math.round((real - quoted) * 1000) / 1000,
    diffExpected: Math.round((real - expected) * 1000) / 1000,
    efficiencyVsQuoted: vsQuoted,
    efficiencyVsExpected: vsExpected,
  };
}

export function processHasStarted(process = {}) {
  if (process.startedAt) return true;
  if (Number(process.realHours) > 0) return true;
  if (Array.isArray(process.sessions) && process.sessions.length > 0) return true;
  return process.status === "COMPLETED";
}

export function canRecalcExpectedHours(process = {}) {
  return process.status === "PENDING" && !processHasStarted(process);
}
