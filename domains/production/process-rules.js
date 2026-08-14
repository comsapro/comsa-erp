export function quotedHoursFromManufacturing(row = {}) {
  if (String(row.unitSnapshot || "").toUpperCase() === "HOUR") {
    return Number(row.quantity) || 0;
  }
  return 0;
}

export function activeProcesses(processes = []) {
  return processes.filter((p) => p.status !== "REPLACED");
}

export function itemHoursSummary(processes = []) {
  const active = activeProcesses(processes);
  const quotedHours = active.reduce((sum, p) => sum + Number(p.quotedHours || 0), 0);
  const realHours = active.reduce((sum, p) => sum + Number(p.realHours || 0), 0);
  return {
    quotedHours: Math.round(quotedHours * 1000) / 1000,
    realHours: Math.round(realHours * 1000) / 1000,
    difference: Math.round((realHours - quotedHours) * 1000) / 1000,
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
  return true;
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
  }));
}
