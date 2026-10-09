import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { generateFolio } from "@/lib/folios";
import { recalculateQuote } from "@/domains/quotes/recalculate";
import { copyQuotedProcessesForOrderItems } from "@/domains/production/process-copy";
import { DIRECT_ORDER_STATUSES, VALID_TRANSITIONS } from "./constants";
import {
  directOrderCreateSchema,
  directOrderUpdateSchema,
  directOrderItemUpsertSchema,
  directOrderRejectSchema,
  directOrderCancelSchema,
} from "./schemas";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isSellerScopedUser,
  resolveSalesScope,
  sellerWhere,
} from "@/domains/sales/scope";

const SORTABLE = ["folio", "status", "requestDate", "createdAt"];

const LIST_INCLUDE = {
  client: { select: { id: true, commercialName: true } },
  seller: { select: { id: true, name: true, email: true } },
  issuingCompany: { select: { id: true, commercialName: true } },
  quote: { select: { id: true, folio: true, status: true } },
  productionOrder: { select: { id: true, folio: true, status: true } },
};

const DETAIL_INCLUDE = {
  client: true,
  clientContact: true,
  seller: { select: { id: true, name: true, email: true } },
  issuingCompany: true,
  approvedByUser: { select: { id: true, name: true } },
  rejectedByUser: { select: { id: true, name: true } },
  cancelledByUser: { select: { id: true, name: true } },
  quote: { select: { id: true, folio: true, status: true } },
  productionOrder: { select: { id: true, folio: true, status: true } },
  items: {
    orderBy: { position: "asc" },
    include: {
      item: { select: { id: true, sku: true, name: true } },
    },
  },
};

function assertTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError(
      `No se puede cambiar el estatus de ${from} a ${to}`
    );
  }
}

async function findDirectOrderOrThrow(id, include = undefined) {
  const record = await prisma.directOrder.findFirst({
    where: { id, deletedAt: null },
    include,
  });
  if (!record) throw new NotFoundError("Orden directa no encontrada");
  return record;
}

function assertDraft(order) {
  if (order.status !== "DRAFT") {
    throw new ConflictError(
      "Solo se pueden editar ordenes directas en borrador"
    );
  }
}

async function nextItemPosition(tx, directOrderId) {
  const agg = await tx.directOrderItem.aggregate({
    where: { directOrderId },
    _max: { position: true },
  });
  return (agg._max.position || 0) + 1;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function createCompanionQuote(tx, order, actorId) {
  const elaborationDate = order.requestDate || new Date();
  const validUntil = order.validUntil || addDays(elaborationDate, 30);
  const folio = await generateFolio(tx, "QUOTE", elaborationDate);
  return tx.quote.create({
    data: {
      folio,
      clientId: order.clientId,
      clientContactId: order.clientContactId || null,
      sellerId: order.sellerId,
      issuingCompanyId: order.issuingCompanyId,
      orderType: "DIRECT_ORDER_REFERENCE",
      currency: "MXN",
      elaborationDate,
      requestDate: order.requestDate,
      validUntil,
      requisition: order.requisition ?? null,
      internalObservations: order.observations ?? null,
      status: "DRAFT",
      priceAfterProduction: true,
      directOrderId: order.id,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

async function ensureCompanionQuote(actor, order) {
  if (order.quote || order.status !== "DRAFT") return order;
  await prisma.$transaction(async (tx) => {
    const current = await tx.quote.findFirst({
      where: { directOrderId: order.id, deletedAt: null },
      select: { id: true },
    });
    if (current) return;
    await createCompanionQuote(tx, order, actor.id);
  });
  return findDirectOrderOrThrow(order.id, DETAIL_INCLUDE);
}

function directStatusForQuote(quote) {
  if (quote.status === "CANCELLED") return "CANCELLED";
  if (quote.status === "REJECTED") return "REJECTED";
  if (quote.status === "IN_PRODUCTION" || quote.status === "SELLER_REVIEW") {
    return "IN_PRODUCTION";
  }
  if (quote.status === "APPROVED") {
    return quote.productionOrderId ? "IN_PRODUCTION" : "APPROVED";
  }
  if (quote.status === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  return "DRAFT";
}

async function adoptPriceAfterQuotes(actorId) {
  const loose = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      priceAfterProduction: true,
      directOrderId: null,
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  for (const quote of loose) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.quote.findFirst({
        where: { id: quote.id, directOrderId: null, deletedAt: null },
      });
      if (!fresh) return;
      const folioTaken = await tx.directOrder.findFirst({
        where: { folio: fresh.folio },
        select: { id: true },
      });
      const folio = folioTaken
        ? await generateFolio(
            tx,
            "DIRECT_ORDER",
            fresh.requestDate || fresh.elaborationDate
          )
        : fresh.folio;
      const orderType = ["GENERAL", "URGENT", "WAREHOUSE"].includes(fresh.orderType)
        ? fresh.orderType
        : "GENERAL";
      const order = await tx.directOrder.create({
        data: {
          folio,
          orderType,
          clientId: fresh.clientId,
          clientContactId: fresh.clientContactId,
          sellerId: fresh.sellerId,
          issuingCompanyId: fresh.issuingCompanyId,
          requestDate: fresh.requestDate || fresh.elaborationDate,
          validUntil: fresh.validUntil,
          requisition: fresh.requisition,
          observations: fresh.internalObservations,
          status: directStatusForQuote(fresh),
          productionOrderId: fresh.productionOrderId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.quote.update({
        where: { id: fresh.id },
        data: { directOrderId: order.id },
      });
    });
  }
}

export async function listDirectOrders(request) {
  await requirePermission("direct_orders.view");
  const actor = await getActor(request);
  await adoptPriceAfterQuotes(actor.id);
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  const where = { deletedAt: null };

  const tab = params.searchParams.get("tab");
  if (tab === "pending") {
    where.status = "PENDING_APPROVAL";
  } else if (tab === "approved") {
    where.status = { in: ["APPROVED", "QUOTED", "IN_PRODUCTION"] };
  } else if (tab === "draft") {
    where.status = "DRAFT";
  } else if (tab === "closed") {
    where.status = { in: ["REJECTED", "CANCELLED"] };
  } else if (DIRECT_ORDER_STATUSES.includes(params.status)) {
    where.status = params.status;
  }

  const clientId = params.searchParams.get("clientId");
  if (clientId) where.clientId = clientId;

  const sellerId = params.searchParams.get("sellerId");
  const user = await getCurrentUser();
  if (isSellerScopedUser(user)) {
    const scope = await resolveSalesScope(request, {
      sellerIdParam: sellerId || undefined,
    });
    Object.assign(where, sellerWhere(scope));
  } else if (sellerId) {
    where.sellerId = sellerId;
  }

  if (params.q) {
    where.OR = [
      { folio: { contains: params.q, mode: "insensitive" } },
      { requisition: { contains: params.q, mode: "insensitive" } },
      {
        client: {
          commercialName: { contains: params.q, mode: "insensitive" },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.directOrder.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: LIST_INCLUDE,
    }),
    prisma.directOrder.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getDirectOrder(request, id) {
  await requirePermission("direct_orders.view");
  const actor = await getActor(request);
  const found = await findDirectOrderOrThrow(id, DETAIL_INCLUDE);
  const record = await ensureCompanionQuote(actor, found);
  return jsonOk(record);
}

export async function createDirectOrder(request) {
  await requirePermission("direct_orders.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = directOrderCreateSchema.parse(body);

  if (data.validUntil && data.validUntil < data.requestDate) {
    throw new ValidationError(
      "La vigencia debe ser posterior o igual a la fecha de solicitud"
    );
  }

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, deletedAt: null },
  });
  if (!client) throw new NotFoundError("Cliente no encontrado");
  if (client.status !== "ACTIVE") {
    throw new ValidationError("El cliente debe estar activo");
  }

  if (data.clientContactId) {
    const contact = await prisma.clientContact.findFirst({
      where: { id: data.clientContactId, clientId: data.clientId },
    });
    if (!contact) {
      throw new ValidationError(
        "El contacto no pertenece al cliente seleccionado"
      );
    }
  }

  const sellerId = data.sellerId || actor.id;
  if (!sellerId) {
    throw new ValidationError("El vendedor es requerido");
  }
  const seller = await prisma.user.findFirst({
    where: { id: sellerId, deletedAt: null },
  });
  if (!seller) throw new NotFoundError("Vendedor no encontrado");
  if (seller.status !== "ACTIVE") {
    throw new ValidationError("El vendedor debe estar activo");
  }

  const company = await prisma.issuingCompany.findFirst({
    where: { id: data.issuingCompanyId, deletedAt: null },
  });
  if (!company) throw new NotFoundError("Empresa emisora no encontrada");
  if (company.status !== "ACTIVE") {
    throw new ValidationError("La empresa emisora debe estar activa");
  }

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "DIRECT_ORDER", data.requestDate);
    const order = await tx.directOrder.create({
      data: {
        folio,
        orderType: data.orderType,
        clientId: data.clientId,
        clientContactId: data.clientContactId || null,
        sellerId,
        issuingCompanyId: data.issuingCompanyId,
        requestDate: data.requestDate,
        validUntil: data.validUntil || null,
        requisition: data.requisition ?? null,
        observations: data.observations ?? null,
        status: "DRAFT",
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await createCompanionQuote(tx, order, actor.id);
    return tx.directOrder.findFirst({
      where: { id: order.id },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function updateDirectOrder(request, id) {
  await requirePermission("direct_orders.edit");
  const actor = await getActor(request);
  const existing = await findDirectOrderOrThrow(id, DETAIL_INCLUDE);
  assertDraft(existing);

  const body = await request.json();
  const data = directOrderUpdateSchema.parse(body);

  const requestDate = data.requestDate ?? existing.requestDate;
  const validUntil =
    data.validUntil !== undefined ? data.validUntil : existing.validUntil;
  if (validUntil && validUntil < requestDate) {
    throw new ValidationError(
      "La vigencia debe ser posterior o igual a la fecha de solicitud"
    );
  }

  const clientId = data.clientId ?? existing.clientId;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundError("Cliente no encontrado");
    if (client.status !== "ACTIVE") {
      throw new ValidationError("El cliente debe estar activo");
    }
  }

  if (data.clientContactId !== undefined && data.clientContactId) {
    const contact = await prisma.clientContact.findFirst({
      where: { id: data.clientContactId, clientId },
    });
    if (!contact) {
      throw new ValidationError(
        "El contacto no pertenece al cliente seleccionado"
      );
    }
  }

  if (data.sellerId === null) {
    throw new ValidationError("El vendedor es requerido");
  }
  if (data.sellerId) {
    const seller = await prisma.user.findFirst({
      where: { id: data.sellerId, deletedAt: null },
    });
    if (!seller) throw new NotFoundError("Vendedor no encontrado");
    if (seller.status !== "ACTIVE") {
      throw new ValidationError("El vendedor debe estar activo");
    }
  }

  if (data.issuingCompanyId === null) {
    throw new ValidationError("La empresa emisora es requerida");
  }
  if (data.issuingCompanyId) {
    const company = await prisma.issuingCompany.findFirst({
      where: { id: data.issuingCompanyId, deletedAt: null },
    });
    if (!company) throw new NotFoundError("Empresa emisora no encontrada");
    if (company.status !== "ACTIVE") {
      throw new ValidationError("La empresa emisora debe estar activa");
    }
  }

  if (data.clientId === null) {
    throw new ValidationError("El cliente es requerido");
  }

  const record = await prisma.directOrder.update({
    where: { id },
    data: {
      ...data,
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function removeDirectOrder(request, id) {
  await requirePermission("direct_orders.delete_draft");
  const actor = await getActor(request);
  const existing = await findDirectOrderOrThrow(id);
  assertDraft(existing);

  await prisma.directOrder.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });

  return jsonOk({ ok: true });
}

export async function upsertDirectOrderItem(request, directOrderId) {
  await requirePermission("direct_orders.edit");
  const actor = await getActor(request);
  const order = await findDirectOrderOrThrow(directOrderId);
  assertDraft(order);

  const body = await request.json();
  const data = directOrderItemUpsertSchema.parse(body);

  if (data.itemId) {
    const catalogItem = await prisma.item.findFirst({
      where: { id: data.itemId, deletedAt: null },
    });
    if (!catalogItem) throw new NotFoundError("Item de catalogo no encontrado");
    if (catalogItem.status !== "ACTIVE") {
      throw new ValidationError("No se puede seleccionar un item inactivo");
    }
  }

  const itemFields = {
    itemId: data.itemId || null,
    description: data.description,
    quantity: data.quantity,
    unit: data.unit ?? null,
    observations: data.observations ?? null,
    benefitPercentage: data.benefitPercentage,
  };

  let record;
  if (data.id) {
    const existingItem = await prisma.directOrderItem.findFirst({
      where: { id: data.id, directOrderId },
    });
    if (!existingItem) {
      throw new NotFoundError("Item de orden directa no encontrado");
    }
    await prisma.directOrderItem.update({
      where: { id: data.id },
      data: itemFields,
    });
  } else {
    const position = await nextItemPosition(prisma, directOrderId);
    await prisma.directOrderItem.create({
      data: {
        directOrderId,
        position,
        ...itemFields,
      },
    });
  }

  record = await findDirectOrderOrThrow(directOrderId, DETAIL_INCLUDE);

  await prisma.directOrder.update({
    where: { id: directOrderId },
    data: { updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: directOrderId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: order,
    newData: record,
  });

  return jsonOk(record);
}

export async function deleteDirectOrderItem(request, directOrderId, itemId) {
  await requirePermission("direct_orders.edit");
  const actor = await getActor(request);
  const order = await findDirectOrderOrThrow(directOrderId);
  assertDraft(order);

  const item = await prisma.directOrderItem.findFirst({
    where: { id: itemId, directOrderId },
  });
  if (!item) throw new NotFoundError("Item de orden directa no encontrado");

  await prisma.directOrderItem.delete({ where: { id: itemId } });
  await prisma.directOrder.update({
    where: { id: directOrderId },
    data: { updatedBy: actor.id },
  });

  const record = await findDirectOrderOrThrow(directOrderId, DETAIL_INCLUDE);

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: directOrderId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: order,
    newData: record,
  });

  return jsonOk(record);
}

async function transitionDirectOrder(request, id, {
  permission,
  toStatus,
  auditAction,
  applyData,
  parseBody,
}) {
  await requirePermission(permission);
  const actor = await getActor(request);
  const existing = await findDirectOrderOrThrow(id, DETAIL_INCLUDE);
  assertTransition(existing.status, toStatus);

  let bodyData = null;
  if (parseBody) {
    const body = await request.json();
    bodyData = parseBody(body);
  }

  const extra = applyData
    ? await applyData({ actor, existing, bodyData })
    : {};

  const record = await prisma.directOrder.update({
    where: { id },
    data: {
      status: toStatus,
      updatedBy: actor.id,
      ...extra,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: id,
    action: auditAction,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function submitDirectOrder(request, id) {
  await requirePermission("direct_orders.submit");
  const existing = await findDirectOrderOrThrow(id, {
    items: true,
  });
  const quote = await prisma.quote.findFirst({
    where: { directOrderId: id, deletedAt: null },
    include: {
      items: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
  const hasQuoteItems = (quote?.items?.length || 0) > 0;
  if (quote && !hasQuoteItems) {
    throw new ValidationError(
      "Captura al menos una partida con procesos, materiales, extras o instalacion antes de enviar a autorizacion"
    );
  }
  if (!quote && !existing.items.length) {
    throw new ValidationError(
      "La orden directa debe tener al menos un item para enviar a aprobacion"
    );
  }

  return transitionDirectOrder(request, id, {
    permission: "direct_orders.submit",
    toStatus: "PENDING_APPROVAL",
    auditAction: AUDIT_ACTIONS.SUBMIT,
  });
}

export async function approveDirectOrder(request, id) {
  await transitionDirectOrder(request, id, {
    permission: "direct_orders.approve",
    toStatus: "APPROVED",
    auditAction: AUDIT_ACTIONS.APPROVE,
    applyData: async ({ actor }) => ({
      approvedBy: actor.id,
      approvedAt: new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    }),
  });
  return releaseDirectOrderToProduction(request, id, { skipPermission: true });
}

export async function rejectDirectOrder(request, id) {
  return transitionDirectOrder(request, id, {
    permission: "direct_orders.reject",
    toStatus: "REJECTED",
    auditAction: AUDIT_ACTIONS.REJECT,
    parseBody: (body) => directOrderRejectSchema.parse(body),
    applyData: async ({ actor, bodyData }) => ({
      rejectedBy: actor.id,
      rejectedAt: new Date(),
      rejectionReason: bodyData.reason,
      approvedBy: null,
      approvedAt: null,
    }),
  });
}

export async function returnDirectOrderToDraft(request, id) {
  return transitionDirectOrder(request, id, {
    permission: "direct_orders.edit",
    toStatus: "DRAFT",
    auditAction: AUDIT_ACTIONS.RETURN_TO_DRAFT,
    applyData: async () => ({
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    }),
  });
}

export async function cancelDirectOrder(request, id) {
  return transitionDirectOrder(request, id, {
    permission: "direct_orders.cancel",
    toStatus: "CANCELLED",
    auditAction: AUDIT_ACTIONS.CANCEL,
    parseBody: (body) => directOrderCancelSchema.parse(body),
    applyData: async ({ actor, bodyData }) => ({
      cancelledBy: actor.id,
      cancelledAt: new Date(),
      cancellationReason: bodyData.reason,
    }),
  });
}

export async function convertToQuote(request, id) {
  await requirePermission("direct_orders.convert_to_quote");
  const actor = await getActor(request);
  const existing = await findDirectOrderOrThrow(id, {
    ...DETAIL_INCLUDE,
    items: { orderBy: { position: "asc" } },
  });

  assertTransition(existing.status, "QUOTED");

  if (existing.status !== "APPROVED") {
    throw new ConflictError(
      "Solo se pueden convertir a cotizacion ordenes directas aprobadas"
    );
  }
  if (existing.quote) {
    throw new ConflictError(
      "La orden directa ya tiene una cotizacion asociada"
    );
  }
  if (!existing.items.length) {
    throw new ValidationError(
      "La orden directa no tiene items para convertir a cotizacion"
    );
  }

  const elaborationDate = new Date();
  const validUntil =
    existing.validUntil || addDays(elaborationDate, 30);

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "QUOTE", elaborationDate);
    const quote = await tx.quote.create({
      data: {
        folio,
        clientId: existing.clientId,
        clientContactId: existing.clientContactId || null,
        sellerId: existing.sellerId,
        issuingCompanyId: existing.issuingCompanyId,
        orderType: "DIRECT_ORDER_REFERENCE",
        currency: "MXN",
        elaborationDate,
        requestDate: existing.requestDate,
        validUntil,
        requisition: existing.requisition ?? null,
        internalObservations: existing.observations ?? null,
        status: "DRAFT",
        priceAfterProduction: true,
        directOrderId: existing.id,
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: existing.items.map((item, index) => ({
            position: item.position || index + 1,
            itemId: item.itemId || null,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            benefitPercentage: item.benefitPercentage,
            internalObservations: item.observations ?? null,
          })),
        },
      },
    });

    await recalculateQuote(tx, quote.id);

    return tx.directOrder.update({
      where: { id },
      data: {
        status: "QUOTED",
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: id,
    action: AUDIT_ACTIONS.CONVERT_TO_QUOTE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function sendDirectOrderToProduction(request, id) {
  return releaseDirectOrderToProduction(request, id);
}

async function releaseDirectOrderToProduction(request, id, { skipPermission = false } = {}) {
  if (!skipPermission) {
    await requirePermission("direct_orders.send_to_production");
  }
  const actor = await getActor(request);
  const existing = await findDirectOrderOrThrow(id, {
    ...DETAIL_INCLUDE,
    items: { orderBy: { position: "asc" } },
  });

  if (existing.status === "IN_PRODUCTION" && existing.productionOrderId) {
    return jsonOk(existing);
  }

  assertTransition(existing.status, "IN_PRODUCTION");

  if (existing.status !== "APPROVED") {
    throw new ConflictError(
      "Solo se pueden enviar a produccion ordenes directas aprobadas"
    );
  }
  if (existing.productionOrderId) {
    throw new ConflictError(
      "La orden directa ya tiene una orden de produccion asociada"
    );
  }

  const quote = existing.quote?.id
    ? await prisma.quote.findFirst({
        where: { id: existing.quote.id, deletedAt: null },
        include: {
          items: {
            where: { status: "ACTIVE" },
            orderBy: { position: "asc" },
          },
        },
      })
    : null;
  const quoteItems = quote?.items || [];
  if (!quoteItems.length && !existing.items.length) {
    throw new ValidationError(
      "La orden directa no tiene partidas para enviar a produccion"
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "PRODUCTION");
    const useQuoteItems = quoteItems.length > 0;
    const productionOrder = await tx.productionOrder.create({
      data: {
        folio,
        sourceType: "DIRECT_ORDER",
        clientId: existing.clientId,
        quoteId: useQuoteItems ? quote.id : null,
        approvalDate: existing.approvedAt || new Date(),
        status: "PENDING",
        totalItems: useQuoteItems ? quoteItems.length : existing.items.length,
        completedItems: 0,
        progressPercentage: 0,
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: useQuoteItems
            ? quoteItems.map((item) => ({
                sourceItemId: item.id,
                sourceItemType: "QUOTE_ITEM",
                position: item.position,
                description: item.description,
                quantity: item.quantity,
                status: "PENDING",
              }))
            : existing.items.map((item) => ({
                sourceItemId: item.id,
                sourceItemType: "DIRECT_ORDER_ITEM",
                position: item.position,
                description: item.description,
                quantity: item.quantity,
                status: "PENDING",
              })),
        },
      },
      include: { items: true },
    });

    if (useQuoteItems) {
      await copyQuotedProcessesForOrderItems(
        tx,
        productionOrder.items,
        actor.id
      );
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "IN_PRODUCTION",
          productionOrderId: productionOrder.id,
          updatedBy: actor.id,
        },
      });
    }

    return tx.directOrder.update({
      where: { id },
      data: {
        status: "IN_PRODUCTION",
        productionOrderId: productionOrder.id,
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "direct_orders",
    entity: "DirectOrder",
    entityId: id,
    action: AUDIT_ACTIONS.SEND_TO_PRODUCTION,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}
