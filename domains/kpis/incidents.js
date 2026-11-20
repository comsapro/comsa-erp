import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { getCurrentUser, userHasAnyPermission, userHasPermission } from "@/lib/auth/session";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/require-permission";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordProductionActivity } from "@/domains/production/activity";
import { assertActiveUser } from "@/domains/users/assert-active";
import { notifyUsers } from "@/domains/notifications/service";
import { incidentActionSchema, meetingIncidentSchema, trackingStatusSchema } from "./schemas";
import {
  INCIDENT_PRIORITY_ICONS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_STATUS_LABELS,
  KPI_MODULES,
  OPEN_INCIDENT_STATUSES,
  TRACKING_STATUS_LABELS,
} from "./constants";
import { getCatalogMaps } from "./settings";
import { loadTrackingRow } from "./data";
import { keyToDate, todayKey } from "./periods";

const MANAGE_PERMISSIONS = ["kpis.manage_incidents", "production.manage_incidents"];

const REASON_TO_INCIDENT_TYPE = {
  MATERIAL: "MATERIAL",
  PROCESS: "PROCESS",
  PRODUCTION_ISSUE: "ITEM",
  QUALITY_ISSUE: "ITEM",
  CLIENT_INFO: "DOCUMENTATION",
  APPROVAL: "ORDER",
  SUPPLIER_ISSUE: "MATERIAL",
};

function canManage(user) {
  return userHasAnyPermission(user, MANAGE_PERMISSIONS);
}

function incidentLink(id) {
  return `/incidencias?id=${encodeURIComponent(id)}`;
}

const INCIDENT_INCLUDE = {
  productionOrder: {
    select: {
      id: true,
      folio: true,
      client: { select: { id: true, commercialName: true } },
      quote: { select: { id: true, folio: true, seller: { select: { id: true, name: true } } } },
      directOrder: { select: { id: true, folio: true, seller: { select: { id: true, name: true } } } },
    },
  },
  productionItem: {
    select: { id: true, position: true, description: true, commitmentDate: true, status: true },
  },
  assignedToUser: { select: { id: true, name: true } },
  reportedByUser: { select: { id: true, name: true } },
};

function mapIncident(row, catalogs) {
  const reason = row.reasonCode ? catalogs?.STOP_REASON?.[row.reasonCode] : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    statusLabel: INCIDENT_STATUS_LABELS[row.status] || row.status,
    priority: row.priority,
    blocking: row.blocking,
    reasonCode: row.reasonCode,
    reasonLabel: reason?.label || null,
    requiredAction: reason?.requiredAction || null,
    relatedModules: row.relatedModules || [],
    relatedModuleLabels: (row.relatedModules || []).map((m) => KPI_MODULES[m] || m),
    source: row.source,
    actionTaken: row.actionTaken,
    createdAt: row.createdAt,
    attendedAt: row.attendedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    assignedTo: row.assignedToUser,
    reportedBy: row.reportedByUser,
    productionOrderId: row.productionOrderId,
    project: row.productionOrder?.folio,
    client: row.productionOrder?.client?.commercialName || "",
    quoteFolio: row.productionOrder?.quote?.folio || row.productionOrder?.directOrder?.folio || null,
    seller: row.productionOrder?.quote?.seller || row.productionOrder?.directOrder?.seller || null,
    productionItemId: row.productionItemId,
    position: row.productionItem?.position ?? null,
    itemDescription: row.productionItem?.description || null,
  };
}

async function loadIncidentOrThrow(id) {
  const row = await prisma.productionIncident.findFirst({
    where: { id },
    include: INCIDENT_INCLUDE,
  });
  if (!row) throw new NotFoundError("Incidencia no encontrada");
  return row;
}

function assertCanSee(user, row) {
  if (canManage(user) || userHasPermission(user, "kpis.view")) return;
  if (row.assignedToUserId === user.id || row.reportedBy === user.id) return;
  throw new ForbiddenError("No puedes consultar esta incidencia");
}

// -----------------------------------------------------------------------------
// Registro desde la vista de seguimiento / junta
// -----------------------------------------------------------------------------

export async function createMeetingIncident(request) {
  await requireAnyPermission(MANAGE_PERMISSIONS);
  const actor = await getActor(request);
  const data = meetingIncidentSchema.parse(await request.json());

  const item = await prisma.productionItem.findFirst({
    where: { id: data.productionItemId },
    include: {
      productionOrder: {
        select: {
          id: true,
          folio: true,
          status: true,
          client: { select: { commercialName: true } },
          quote: { select: { folio: true } },
          directOrder: { select: { folio: true } },
        },
      },
    },
  });
  if (!item) throw new NotFoundError("Trabajo no encontrado");
  if (item.productionOrder.status === "CANCELLED") {
    throw new ConflictError("La orden de produccion esta cancelada");
  }

  const catalogs = await getCatalogMaps();
  const reason = catalogs.STOP_REASON[data.reasonCode];
  if (!reason || reason.status !== "ACTIVE") {
    throw new ValidationError("Razon no valida", { reasonCode: ["Selecciona una razon del catalogo"] });
  }
  const assignee = await assertActiveUser(data.assignedToUserId, "Responsable");

  const order = item.productionOrder;
  const title = data.title ? `${reason.label}: ${data.title}` : reason.label;
  const description = data.comment || reason.label;

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.productionIncident.create({
      data: {
        productionOrderId: order.id,
        productionItemId: item.id,
        type: REASON_TO_INCIDENT_TYPE[reason.code] || "OTHER",
        status: "OPEN",
        blocking: data.stopsWork,
        title,
        description,
        priority: data.priority,
        reasonCode: reason.code,
        relatedModules: reason.relatedModules || [],
        source: "MEETING",
        assignedToUserId: assignee.id,
        reportedBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await tx.productionIncidentComment.create({
      data: {
        incidentId: created.id,
        kind: "CREATED",
        body: [
          `${data.stopsWork ? "Trabajo detenido" : "Incidencia registrada"} · ${reason.label}`,
          `Responsable: ${assignee.name}`,
          data.comment ? `Comentario: ${data.comment}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        createdBy: actor.id,
      },
    });
    await recordProductionActivity(tx, {
      type: "INCIDENT",
      productionOrderId: order.id,
      productionItemId: item.id,
      incidentId: created.id,
      body: `${data.stopsWork ? "Trabajo detenido" : "Incidencia"} (junta): ${title}`,
      payload: { reasonCode: reason.code, priority: data.priority, assignedToUserId: assignee.id },
      createdBy: actor.id,
    });
    const icon = INCIDENT_PRIORITY_ICONS[data.priority] || "🔴";
    await notifyUsers(tx, {
      userIds: [assignee.id],
      createdBy: actor.id,
      skipAuthor: false,
      type: "INCIDENT_ASSIGNED",
      priority: data.priority,
      title: `${icon} ${INCIDENT_PRIORITY_LABELS[data.priority]} — ${
        data.stopsWork ? "Trabajo detenido" : "Incidencia"
      } por ${reason.label.toLowerCase()}`,
      body: [
        `Proyecto: ${order.folio}`,
        order.quote?.folio || order.directOrder?.folio
          ? `Cotización: ${order.quote?.folio || order.directOrder?.folio}`
          : null,
        `Cliente: ${order.client?.commercialName || "-"}`,
        `Partida ${item.position}: ${item.description}`,
        `Razón: ${reason.label}`,
        data.comment ? `Comentario: ${data.comment}` : null,
        reason.requiredAction ? reason.requiredAction : null,
      ]
        .filter(Boolean)
        .join("\n"),
      link: incidentLink(created.id),
      entityType: "ProductionIncident",
      entityId: created.id,
    });
    return created;
  });

  await recordAudit({
    actor,
    module: "kpis",
    entity: "ProductionIncident",
    entityId: incident.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: {
      title,
      reasonCode: reason.code,
      priority: data.priority,
      blocking: data.stopsWork,
      assignedToUserId: assignee.id,
      productionItemId: item.id,
    },
  });

  const row = await loadIncidentOrThrow(incident.id);
  return jsonCreated(mapIncident(row, catalogs));
}

// -----------------------------------------------------------------------------
// Consulta
// -----------------------------------------------------------------------------

export async function listIncidents(request) {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  const url = new URL(request.url);
  const manage = canManage(user) || userHasPermission(user, "kpis.view");
  const requested = url.searchParams.get("scope") || "mine";
  const scope = requested === "all" && !manage ? "mine" : requested;
  const status = url.searchParams.get("status") || "open";
  const q = (url.searchParams.get("q") || "").trim();

  const where = {
    ...(scope === "mine"
      ? { OR: [{ assignedToUserId: user.id }, { reportedBy: user.id }] }
      : scope === "assigned"
        ? { assignedToUserId: user.id }
        : {}),
    ...(status === "open"
      ? { status: { in: OPEN_INCIDENT_STATUSES } }
      : status === "closed"
        ? { status: { in: ["RESOLVED", "CLOSED"] } }
        : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { productionOrder: { folio: { contains: q, mode: "insensitive" } } },
                { productionOrder: { client: { commercialName: { contains: q, mode: "insensitive" } } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [rows, catalogs] = await Promise.all([
    prisma.productionIncident.findMany({
      where,
      include: INCIDENT_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    }),
    getCatalogMaps(),
  ]);

  const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const data = rows
    .map((r) => mapIncident(r, catalogs))
    .sort((a, b) => {
      const openA = OPEN_INCIDENT_STATUSES.includes(a.status) ? 0 : 1;
      const openB = OPEN_INCIDENT_STATUSES.includes(b.status) ? 0 : 1;
      return openA - openB || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  return jsonOk({ data, canManage: manage, scope });
}

export async function getIncident(request, id) {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  const row = await loadIncidentOrThrow(id);
  assertCanSee(user, row);
  const [comments, catalogs] = await Promise.all([
    prisma.productionIncidentComment.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: "asc" },
      include: { createdByUser: { select: { id: true, name: true } } },
    }),
    getCatalogMaps(),
  ]);
  const isAssignee = row.assignedToUserId === user.id;
  const isReporter = row.reportedBy === user.id;
  const manage = canManage(user);
  const open = OPEN_INCIDENT_STATUSES.includes(row.status);
  return jsonOk({
    ...mapIncident(row, catalogs),
    comments: comments.map((c) => ({
      id: c.id,
      kind: c.kind,
      body: c.body,
      createdAt: c.createdAt,
      createdBy: c.createdByUser,
    })),
    permissions: {
      attend: open && row.status === "OPEN" && (isAssignee || manage),
      comment: isAssignee || isReporter || manage,
      resolve: open && (isAssignee || manage),
      close: row.status !== "CLOSED" && manage,
      reopen: !open && (manage || isReporter),
      reassign: open && manage,
      priority: open && manage,
    },
  });
}

// -----------------------------------------------------------------------------
// Seguimiento (atender, comentar, resolver, cerrar, reabrir, reasignar)
// -----------------------------------------------------------------------------

export async function incidentAction(request, id) {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  const actor = await getActor(request);
  const row = await loadIncidentOrThrow(id);
  assertCanSee(user, row);
  const data = incidentActionSchema.parse(await request.json());

  const manage = canManage(user);
  const isAssignee = row.assignedToUserId === user.id;
  const isReporter = row.reportedBy === user.id;
  const open = OPEN_INCIDENT_STATUSES.includes(row.status);
  const deny = () => {
    throw new ForbiddenError("No puedes realizar esta accion sobre la incidencia");
  };

  const patch = { updatedBy: actor.id };
  let commentKind = "COMMENT";
  let commentBody = data.comment || null;
  let notify = null;
  const now = new Date();

  switch (data.action) {
    case "attend":
      if (!(isAssignee || manage)) deny();
      if (row.status !== "OPEN") throw new ConflictError("La incidencia ya esta en atencion o cerrada");
      patch.status = "IN_REVIEW";
      patch.attendedAt = row.attendedAt || now;
      patch.attendedBy = actor.id;
      commentKind = "ATTENDED";
      commentBody = `En atención${data.comment ? `: ${data.comment}` : ""}`;
      notify = { to: [row.reportedBy], title: `Incidencia en atención · ${row.productionOrder?.folio}` };
      break;
    case "comment":
      if (!(isAssignee || isReporter || manage)) deny();
      notify = {
        to: isAssignee ? [row.reportedBy] : [row.assignedToUserId],
        title: `Nuevo comentario en incidencia · ${row.productionOrder?.folio}`,
      };
      break;
    case "resolve":
      if (!(isAssignee || manage)) deny();
      if (!open) throw new ConflictError("La incidencia ya fue resuelta o cerrada");
      patch.status = "RESOLVED";
      patch.resolvedAt = now;
      patch.resolvedBy = actor.id;
      patch.actionTaken = data.comment;
      if (!row.attendedAt) {
        patch.attendedAt = now;
        patch.attendedBy = actor.id;
      }
      commentKind = "RESOLVED";
      commentBody = `Resuelta: ${data.comment}`;
      notify = {
        to: [row.reportedBy],
        title: `✅ Incidencia resuelta · ${row.productionOrder?.folio}`,
        priority: row.priority,
      };
      break;
    case "close":
      if (!manage) deny();
      if (row.status === "CLOSED") throw new ConflictError("La incidencia ya esta cerrada");
      patch.status = "CLOSED";
      patch.closedAt = now;
      patch.closedBy = actor.id;
      if (!row.resolvedAt) {
        patch.resolvedAt = now;
        patch.resolvedBy = actor.id;
      }
      commentKind = "CLOSED";
      commentBody = `Cerrada${data.comment ? `: ${data.comment}` : ""}`;
      notify = { to: [row.assignedToUserId], title: `Incidencia cerrada · ${row.productionOrder?.folio}` };
      break;
    case "reopen":
      if (!(manage || isReporter)) deny();
      if (open) throw new ConflictError("La incidencia sigue abierta");
      patch.status = "OPEN";
      patch.closedAt = null;
      patch.closedBy = null;
      patch.resolvedAt = null;
      patch.resolvedBy = null;
      commentKind = "REOPENED";
      commentBody = `Reabierta: ${data.comment}`;
      notify = {
        to: [row.assignedToUserId],
        title: `🔁 Incidencia reabierta · ${row.productionOrder?.folio}`,
        priority: row.priority,
      };
      break;
    case "reassign": {
      if (!manage) deny();
      if (!open) throw new ConflictError("Solo se reasignan incidencias abiertas");
      const next = await assertActiveUser(data.assignedToUserId, "Responsable");
      patch.assignedToUserId = next.id;
      commentKind = "REASSIGNED";
      commentBody = `Reasignada a ${next.name}${data.comment ? `: ${data.comment}` : ""}`;
      notify = {
        to: [next.id],
        title: `${INCIDENT_PRIORITY_ICONS[row.priority]} Se te asignó una incidencia · ${row.productionOrder?.folio}`,
        priority: row.priority,
        type: "INCIDENT_ASSIGNED",
      };
      break;
    }
    case "priority":
      if (!manage) deny();
      patch.priority = data.priority;
      commentKind = "PRIORITY";
      commentBody = `Prioridad: ${INCIDENT_PRIORITY_LABELS[row.priority]} → ${INCIDENT_PRIORITY_LABELS[data.priority]}${
        data.comment ? ` · ${data.comment}` : ""
      }`;
      notify = {
        to: [row.assignedToUserId],
        title: `Prioridad actualizada a ${INCIDENT_PRIORITY_LABELS[data.priority]} · ${row.productionOrder?.folio}`,
        priority: data.priority,
      };
      break;
    default:
      throw new ValidationError("Accion no soportada");
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(patch).length > 1) {
      await tx.productionIncident.update({ where: { id }, data: patch });
    }
    if (commentBody) {
      await tx.productionIncidentComment.create({
        data: { incidentId: id, kind: commentKind, body: commentBody, createdBy: actor.id },
      });
    }
    if (patch.status) {
      await recordProductionActivity(tx, {
        type: "INCIDENT",
        productionOrderId: row.productionOrderId,
        productionItemId: row.productionItemId,
        incidentId: id,
        body: `Incidencia ${INCIDENT_STATUS_LABELS[patch.status].toLowerCase()}: ${row.title}`,
        payload: { previousStatus: row.status, status: patch.status },
        createdBy: actor.id,
      });
    }
    if (notify) {
      await notifyUsers(tx, {
        userIds: notify.to,
        createdBy: actor.id,
        type: notify.type || "INCIDENT_UPDATE",
        priority: notify.priority || "MEDIUM",
        title: notify.title,
        body: [row.title, commentBody].filter(Boolean).join("\n"),
        link: incidentLink(id),
        entityType: "ProductionIncident",
        entityId: id,
      });
    }
  });

  await recordAudit({
    actor,
    module: "kpis",
    entity: "ProductionIncident",
    entityId: id,
    action: data.action === "resolve" || data.action === "close" ? AUDIT_ACTIONS.COMPLETE : AUDIT_ACTIONS.UPDATE,
    previousData: { status: row.status, assignedToUserId: row.assignedToUserId, priority: row.priority },
    newData: { action: data.action, ...patch, comment: data.comment || null },
  });

  return getIncident(request, id);
}

// -----------------------------------------------------------------------------
// Estatus operativo de un trabajo
// -----------------------------------------------------------------------------

export async function updateTrackingStatus(request, itemId) {
  await requirePermission("kpis.update_status");
  const actor = await getActor(request);
  const data = trackingStatusSchema.parse(await request.json());
  const item = await prisma.productionItem.findFirst({
    where: { id: itemId },
    select: {
      id: true,
      productionOrderId: true,
      trackingStatus: true,
      deliveredAt: true,
      status: true,
      productionOrder: { select: { status: true } },
    },
  });
  if (!item) throw new NotFoundError("Trabajo no encontrado");
  if (item.status === "CANCELLED" || item.productionOrder.status === "CANCELLED") {
    throw new ConflictError("El trabajo esta cancelado");
  }

  const patch = {
    trackingStatusAt: new Date(),
    trackingStatusBy: actor.id,
    updatedBy: actor.id,
  };
  if (data.status === "AUTO") {
    patch.trackingStatus = null;
    patch.deliveredAt = null;
  } else if (data.status === "DELIVERED") {
    patch.trackingStatus = "DELIVERED";
    patch.deliveredAt = keyToDate(data.deliveredAt || todayKey());
  } else {
    patch.trackingStatus = data.status;
    patch.deliveredAt = null;
  }

  const label = data.status === "AUTO" ? "Automático" : TRACKING_STATUS_LABELS[data.status];
  await prisma.$transaction(async (tx) => {
    await tx.productionItem.update({ where: { id: itemId }, data: patch });
    await recordProductionActivity(tx, {
      type: "STATUS",
      productionOrderId: item.productionOrderId,
      productionItemId: itemId,
      body: `Estatus operativo: ${label}${data.reason ? ` · ${data.reason}` : ""}`,
      payload: {
        previous: { trackingStatus: item.trackingStatus, deliveredAt: item.deliveredAt },
        next: { trackingStatus: patch.trackingStatus, deliveredAt: patch.deliveredAt },
      },
      createdBy: actor.id,
    });
  });

  await recordAudit({
    actor,
    module: "kpis",
    entity: "ProductionItem",
    entityId: itemId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { trackingStatus: item.trackingStatus, deliveredAt: item.deliveredAt },
    newData: { trackingStatus: patch.trackingStatus, deliveredAt: patch.deliveredAt, reason: data.reason },
  });

  return jsonOk(await loadTrackingRow(itemId, todayKey()));
}

/** Usuarios activos para asignar responsables desde el dashboard. */
export async function listAssignableUsers() {
  await requireAnyPermission([...MANAGE_PERMISSIONS, "quality.record_errors", "kpis.view"]);
  const users = await prisma.user.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return jsonOk({ data: users });
}
