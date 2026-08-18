import { allActiveProcessesCompleted } from "./process-rules.js";
import { OPEN_INCIDENT_STATUSES } from "./constants.js";

export function hasBlockingIncidents(incidents = []) {
  return incidents.some(
    (i) =>
      i.blocking &&
      OPEN_INCIDENT_STATUSES.includes(i.status)
  );
}

export function itemHasResponsible(item = {}) {
  if (item.assignedToUserId) return true;
  const processes = item.processes || [];
  return processes.some(
    (p) => p.status !== "REPLACED" && p.assignedToUserId
  );
}

export function itemRealHours(item = {}) {
  return (item.processes || [])
    .filter((p) => p.status !== "REPLACED")
    .reduce((sum, p) => sum + (Number(p.realHours) || 0), 0);
}

export function canCompleteProcess(process = {}, { requireHours = true } = {}) {
  if (!process) return { ok: false, reason: "Proceso no encontrado" };
  if (process.status === "REPLACED") {
    return { ok: false, reason: "El proceso ya fue reemplazado" };
  }
  if (process.status === "COMPLETED") {
    return { ok: false, reason: "El proceso ya esta completado" };
  }
  const hasOwner = Boolean(process.assignedToUserId);
  if (!hasOwner) {
    return { ok: false, reason: "Asigna un responsable al proceso antes de cerrarlo" };
  }
  const hours = Number(process.realHours) || 0;
  const sessions = process.sessions || [];
  const hasClosedSession = sessions.some((s) => s.status === "CLOSED");
  const hasRunning = sessions.some((s) => s.status === "RUNNING");
  if (hasRunning) {
    return { ok: false, reason: "Cierra o pausa la sesion activa antes de finalizar" };
  }
  if (requireHours && hours <= 0 && !hasClosedSession) {
    return {
      ok: false,
      reason: "Registra horas reales o una sesion cerrada antes de finalizar",
    };
  }
  return { ok: true };
}

export function canCompleteItem(item = {}) {
  if (!item) return { ok: false, reason: "Partida no encontrada" };
  if (item.status === "COMPLETED") {
    return { ok: false, reason: "La partida ya esta completada" };
  }
  if (item.status === "CANCELLED") {
    return { ok: false, reason: "La partida esta cancelada" };
  }
  if (!allActiveProcessesCompleted(item.processes || [])) {
    return {
      ok: false,
      reason: "Completa todos los procesos activos antes de cerrar la partida",
    };
  }
  if (hasBlockingIncidents(item.incidents || [])) {
    return {
      ok: false,
      reason: "Hay incidencias bloqueantes abiertas en esta partida",
    };
  }
  if (!itemHasResponsible(item)) {
    return { ok: false, reason: "Asigna un responsable a la partida" };
  }
  return { ok: true };
}

export function canCompleteOrder(order = {}) {
  const items = (order.items || []).filter((i) => i.status !== "CANCELLED");
  if (!items.length) {
    return { ok: false, reason: "La orden no tiene partidas activas" };
  }
  const incomplete = items.filter((i) => i.status !== "COMPLETED");
  if (incomplete.length) {
    return {
      ok: false,
      reason: "Todas las partidas activas deben estar completadas",
    };
  }
  const incidents = [
    ...(order.incidents || []),
    ...items.flatMap((i) => i.incidents || []),
  ];
  if (hasBlockingIncidents(incidents)) {
    return {
      ok: false,
      reason: "Hay incidencias bloqueantes abiertas. Resuelvelas antes de cerrar.",
    };
  }
  return { ok: true };
}
