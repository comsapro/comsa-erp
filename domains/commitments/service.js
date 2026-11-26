import "server-only";
import { handleUpload } from "@vercel/blob/client";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { requirePermission } from "@/lib/permissions/require-permission";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { getCurrentUser, userHasPermission, userIsAdmin } from "@/lib/auth/session";
import { notifyUsers } from "@/domains/notifications/service";
import { commitmentActionSchema, commitmentSchema } from "./schemas";
import {
  MAX_EVIDENCE_BYTES,
  commitmentAbilities,
  isCommitmentOverdue,
  nextStatusFromParticipants,
  todayMx,
} from "./constants";

const USER_SELECT = { select: { id: true, name: true } };

const LIST_INCLUDE = {
  createdByUser: USER_SELECT,
  participants: { include: { user: USER_SELECT }, orderBy: { createdAt: "asc" } },
  _count: { select: { comments: true } },
};

const DETAIL_INCLUDE = {
  createdByUser: USER_SELECT,
  closedByUser: USER_SELECT,
  participants: { include: { user: USER_SELECT }, orderBy: { createdAt: "asc" } },
  comments: { include: { user: USER_SELECT }, orderBy: { createdAt: "asc" } },
};

const dateOnly = (key) => new Date(`${key}T00:00:00.000Z`);

async function sessionContext() {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Sesión requerida");
  return {
    user,
    isAdmin: userIsAdmin(user),
    canViewAll: userIsAdmin(user) || userHasPermission(user, "commitments.view_all"),
  };
}

function withComputed(row, ctx) {
  return {
    ...row,
    overdue: isCommitmentOverdue({ ...row, dueDate: row.dueDate.toISOString() }),
    doneCount: row.participants.filter((p) => p.completedAt).length,
    abilities: commitmentAbilities(row, {
      userId: ctx.user.id,
      isAdmin: ctx.isAdmin,
      canViewAll: ctx.canViewAll,
    }),
  };
}

async function loadOrThrow(id, ctx) {
  const row = await prisma.commitment.findFirst({
    where: { id, deletedAt: null },
    include: DETAIL_INCLUDE,
  });
  if (!row) throw new NotFoundError("Compromiso no encontrado");
  const abilities = commitmentAbilities(row, {
    userId: ctx.user.id,
    isAdmin: ctx.isAdmin,
    canViewAll: ctx.canViewAll,
  });
  if (!abilities.canView) throw new NotFoundError("Compromiso no encontrado");
  return row;
}

async function assertActiveUsers(ids) {
  const unique = [...new Set(ids)];
  const found = await prisma.user.findMany({
    where: { id: { in: unique }, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new ValidationError("Algún involucrado no existe o está inactivo", {
      participantIds: ["Revisa los involucrados"],
    });
  }
  return unique;
}

/**
 * Lista. scope: mine (involucrado o creador; por defecto), pending (mi parte
 * sin terminar), review (creados por mi por aprobar), created, all (admin /
 * commitments.view_all). Con from/to (YYYY-MM-DD) filtra por traslape de fechas
 * para el calendario.
 */
export async function listCommitments(request) {
  await requirePermission("commitments.view");
  const ctx = await sessionContext();
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") || "mine";
  const status = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  const me = ctx.user.id;

  const scopeWhere = {
    mine: { OR: [{ createdBy: me }, { participants: { some: { userId: me } } }] },
    pending: {
      status: "OPEN",
      participants: { some: { userId: me, completedAt: null } },
    },
    review: ctx.isAdmin
      ? { status: "IN_REVIEW" }
      : { status: "IN_REVIEW", createdBy: me },
    created: { createdBy: me },
    all: ctx.canViewAll ? {} : { OR: [{ createdBy: me }, { participants: { some: { userId: me } } }] },
  }[scope] || { OR: [{ createdBy: me }, { participants: { some: { userId: me } } }] };

  const rows = await prisma.commitment.findMany({
    where: {
      deletedAt: null,
      ...scopeWhere,
      ...(status ? { status } : scope === "mine" || scope === "all" ? { status: { not: "CANCELLED" } } : {}),
      ...(from ? { dueDate: { gte: dateOnly(from) } } : {}),
      ...(to ? { startDate: { lte: dateOnly(to) } } : {}),
    },
    include: LIST_INCLUDE,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const data = rows.map((r) => withComputed(r, ctx));
  const today = todayMx();
  const counts = {
    open: data.filter((r) => r.status === "OPEN").length,
    review: data.filter((r) => r.status === "IN_REVIEW").length,
    overdue: data.filter((r) => isCommitmentOverdue({ ...r, dueDate: r.dueDate.toISOString() }, today)).length,
  };
  return jsonOk({
    data,
    counts,
    canCreate: userHasPermission(ctx.user, "commitments.create"),
    canViewAll: ctx.canViewAll,
  });
}

export async function getCommitment(request, id) {
  await requirePermission("commitments.view");
  const ctx = await sessionContext();
  const row = await loadOrThrow(id, ctx);
  return jsonOk(withComputed(row, ctx));
}

export async function createCommitment(request) {
  await requirePermission("commitments.create");
  const actor = await getActor(request);
  const data = commitmentSchema.parse(await request.json());
  const participantIds = await assertActiveUsers(data.participantIds);

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.commitment.create({
      data: {
        title: data.title,
        description: data.description || null,
        startDate: dateOnly(data.startDate),
        dueDate: dateOnly(data.dueDate),
        createdBy: actor.id,
        participants: { create: participantIds.map((userId) => ({ userId })) },
        comments: { create: [{ userId: actor.id, kind: "CREATED" }] },
      },
    });
    await notifyUsers(tx, {
      userIds: participantIds,
      createdBy: actor.id,
      type: "COMMITMENT_ASSIGNED",
      title: `Nuevo compromiso: ${data.title}`,
      body: `Entrega: ${data.dueDate}`,
      link: `/compromisos/${created.id}`,
      entityType: "Commitment",
      entityId: created.id,
    });
    return created;
  });

  await recordAudit({
    actor,
    module: "commitments",
    entity: "Commitment",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { ...data, participantIds },
  });
  return jsonCreated(record);
}

/** Editar titulo, descripcion, fechas e involucrados (creador o admin). */
export async function updateCommitment(request, id) {
  await requirePermission("commitments.view");
  const actor = await getActor(request);
  const ctx = await sessionContext();
  const existing = await loadOrThrow(id, ctx);
  const abilities = commitmentAbilities(existing, { userId: ctx.user.id, isAdmin: ctx.isAdmin });
  if (!abilities.canEdit) throw new ForbiddenError("Solo quien creó el compromiso puede editarlo");

  const data = commitmentSchema.parse(await request.json());
  const participantIds = await assertActiveUsers(data.participantIds);
  const before = new Set(existing.participants.map((p) => p.userId));
  const added = participantIds.filter((uid) => !before.has(uid));
  const removed = [...before].filter((uid) => !participantIds.includes(uid));

  await prisma.$transaction(async (tx) => {
    if (removed.length) {
      await tx.commitmentParticipant.deleteMany({ where: { commitmentId: id, userId: { in: removed } } });
    }
    if (added.length) {
      await tx.commitmentParticipant.createMany({
        data: added.map((userId) => ({ commitmentId: id, userId })),
      });
    }
    const participants = await tx.commitmentParticipant.findMany({ where: { commitmentId: id } });
    await tx.commitment.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        startDate: dateOnly(data.startDate),
        dueDate: dateOnly(data.dueDate),
        status: nextStatusFromParticipants(existing.status, participants),
      },
    });
    await tx.commitmentComment.create({ data: { commitmentId: id, userId: actor.id, kind: "EDITED" } });
    await notifyUsers(tx, {
      userIds: added,
      createdBy: actor.id,
      type: "COMMITMENT_ASSIGNED",
      title: `Te agregaron al compromiso: ${data.title}`,
      body: `Entrega: ${data.dueDate}`,
      link: `/compromisos/${id}`,
      entityType: "Commitment",
      entityId: id,
    });
  });

  await recordAudit({
    actor,
    module: "commitments",
    entity: "Commitment",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: {
      title: existing.title,
      startDate: existing.startDate,
      dueDate: existing.dueDate,
      participantIds: [...before],
    },
    newData: { ...data, participantIds },
  });
  const ctx2 = await sessionContext();
  return jsonOk(withComputed(await loadOrThrow(id, ctx2), ctx2));
}

/**
 * Acciones: comment (con evidencia opcional), done / reopen (mi parte),
 * approve / reject (creador o admin, en revision), cancel.
 */
export async function commitmentAction(request, id) {
  await requirePermission("commitments.view");
  const actor = await getActor(request);
  const ctx = await sessionContext();
  const existing = await loadOrThrow(id, ctx);
  const abilities = commitmentAbilities(existing, {
    userId: ctx.user.id,
    isAdmin: ctx.isAdmin,
    canViewAll: ctx.canViewAll,
  });
  const data = commitmentActionSchema.parse(await request.json());
  if (data.file && !data.file.pathname.startsWith(`commitments/${id}/`)) {
    throw new ValidationError("Archivo de evidencia inválido");
  }

  const allowed = {
    comment: abilities.canComment,
    done: abilities.canMarkDone,
    reopen: abilities.canReopenMine,
    approve: abilities.canApprove,
    reject: abilities.canReject,
    cancel: abilities.canCancel,
  }[data.action];
  if (!allowed) throw new ForbiddenError("No puedes realizar esta acción en el compromiso");

  const kind = {
    comment: "COMMENT",
    done: "DONE",
    reopen: "REOPENED",
    approve: "APPROVED",
    reject: "REJECTED",
    cancel: "CANCELLED",
  }[data.action];

  const participantIds = existing.participants.map((p) => p.userId);
  const link = `/compromisos/${id}`;

  await prisma.$transaction(async (tx) => {
    await tx.commitmentComment.create({
      data: {
        commitmentId: id,
        userId: actor.id,
        kind,
        body: data.body || null,
        filePathname: data.file?.pathname || null,
        fileName: data.file?.fileName || null,
        fileContentType: data.file?.contentType || null,
        fileSizeBytes: data.file?.sizeBytes ?? null,
      },
    });

    if (data.action === "done" || data.action === "reopen") {
      await tx.commitmentParticipant.update({
        where: { commitmentId_userId: { commitmentId: id, userId: actor.id } },
        data: { completedAt: data.action === "done" ? new Date() : null },
      });
      const participants = await tx.commitmentParticipant.findMany({ where: { commitmentId: id } });
      const status = nextStatusFromParticipants(existing.status, participants);
      if (status !== existing.status) {
        await tx.commitment.update({ where: { id }, data: { status } });
        if (status === "IN_REVIEW") {
          await notifyUsers(tx, {
            userIds: [existing.createdBy],
            createdBy: actor.id,
            type: "COMMITMENT_REVIEW",
            title: `Compromiso listo para aprobar: ${existing.title}`,
            body: "Todos los involucrados lo marcaron como terminado.",
            link,
            entityType: "Commitment",
            entityId: id,
          });
        }
      }
    } else if (data.action === "approve") {
      await tx.commitment.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date(), closedBy: actor.id },
      });
      await notifyUsers(tx, {
        userIds: participantIds,
        createdBy: actor.id,
        type: "COMMITMENT_CLOSED",
        title: `Compromiso aprobado y cerrado: ${existing.title}`,
        link,
        entityType: "Commitment",
        entityId: id,
      });
    } else if (data.action === "reject") {
      // No se aprueba: regresa a "En proceso" y todos vuelven a pendiente.
      await tx.commitmentParticipant.updateMany({ where: { commitmentId: id }, data: { completedAt: null } });
      await tx.commitment.update({ where: { id }, data: { status: "OPEN" } });
      await notifyUsers(tx, {
        userIds: participantIds,
        createdBy: actor.id,
        type: "COMMITMENT_REJECTED",
        priority: "HIGH",
        title: `No se aprobó el cierre: ${existing.title}`,
        body: data.body,
        link,
        entityType: "Commitment",
        entityId: id,
      });
    } else if (data.action === "cancel") {
      await tx.commitment.update({
        where: { id },
        data: { status: "CANCELLED", closedAt: new Date(), closedBy: actor.id },
      });
    } else if (data.action === "comment") {
      await notifyUsers(tx, {
        userIds: [...participantIds, existing.createdBy],
        createdBy: actor.id,
        type: "COMMITMENT_COMMENT",
        title: `Comentario en compromiso: ${existing.title}`,
        body: data.body ? data.body.slice(0, 200) : "Se adjuntó evidencia",
        link,
        entityType: "Commitment",
        entityId: id,
      });
    }
  });

  if (["approve", "reject", "cancel"].includes(data.action)) {
    await recordAudit({
      actor,
      module: "commitments",
      entity: "Commitment",
      entityId: id,
      action: {
        approve: AUDIT_ACTIONS.APPROVE,
        reject: AUDIT_ACTIONS.REJECT,
        cancel: AUDIT_ACTIONS.CANCEL,
      }[data.action],
      previousData: { status: existing.status },
      newData: { reason: data.body || null },
    });
  }

  return jsonOk(withComputed(await loadOrThrow(id, ctx), ctx));
}

/** Token de Vercel Blob para subir evidencia (involucrado, creador o admin). */
export async function handleEvidenceUpload(request, id) {
  await requirePermission("commitments.view");
  const ctx = await sessionContext();
  const existing = await loadOrThrow(id, ctx);
  const abilities = commitmentAbilities(existing, { userId: ctx.user.id, isAdmin: ctx.isAdmin });
  if (!abilities.canComment) throw new ForbiddenError("No puedes adjuntar evidencia en este compromiso");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ValidationError("Almacenamiento Blob no configurado (BLOB_READ_WRITE_TOKEN)");
  }
  const body = await request.json();
  const result = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`commitments/${id}/`)) {
        throw new ValidationError("Ruta de archivo inválida");
      }
      return {
        access: "private",
        maximumSizeInBytes: MAX_EVIDENCE_BYTES,
        addRandomSuffix: true,
      };
    },
    // El cliente registra el archivo con la accion "comment".
    onUploadCompleted: async () => {},
  });
  return Response.json(result);
}
