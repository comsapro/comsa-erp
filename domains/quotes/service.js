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
import { lineAmount, MIN_BENEFIT_SALES } from "@/lib/quotes/calculations";
import { QUOTE_STATUSES, VALID_TRANSITIONS } from "./constants";
import {
  quoteCreateSchema,
  quoteUpdateSchema,
  quoteItemUpsertSchema,
  quoteRejectSchema,
  quoteCancelSchema,
  insertTemplateSchema,
  reorderItemsSchema,
} from "./schemas";
import { recalculateQuote } from "./recalculate";

const SORTABLE = [
  "folio",
  "status",
  "elaborationDate",
  "validUntil",
  "total",
  "createdAt",
];

const LIST_INCLUDE = {
  client: { select: { id: true, commercialName: true } },
  seller: { select: { id: true, name: true, email: true } },
  issuingCompany: { select: { id: true, commercialName: true } },
};

const DETAIL_INCLUDE = {
  client: true,
  clientContact: true,
  seller: { select: { id: true, name: true, email: true } },
  issuingCompany: true,
  approvedByUser: { select: { id: true, name: true } },
  rejectedByUser: { select: { id: true, name: true } },
  cancelledByUser: { select: { id: true, name: true } },
  productionOrder: { select: { id: true, folio: true, status: true } },
  productionOrders: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      folio: true,
      status: true,
      materialsReadyAt: true,
      createdAt: true,
    },
  },
  parentQuote: { select: { id: true, folio: true, version: true } },
  childRevisions: {
    orderBy: { createdAt: "desc" },
    select: { id: true, folio: true, version: true, status: true },
  },
  items: {
    orderBy: { position: "asc" },
    include: {
      manufacturing: { orderBy: { sortOrder: "asc" } },
      materials: true,
      extras: true,
      installations: true,
      template: { select: { id: true, name: true } },
      item: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
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

async function findQuoteOrThrow(id, include = undefined) {
  const record = await prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include,
  });
  if (!record) throw new NotFoundError("Cotizacion no encontrada");
  return record;
}

function assertDraft(quote) {
  if (quote.status !== "DRAFT") {
    throw new ConflictError("Solo se pueden editar cotizaciones en borrador");
  }
}

async function resolveManufacturingRows(tx, rows = []) {
  const result = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let processNameSnapshot = row.processNameSnapshot || null;
    let unitSnapshot = row.unitSnapshot || null;

    if (row.manufacturingProcessId) {
      const process = await tx.manufacturingProcess.findFirst({
        where: { id: row.manufacturingProcessId, deletedAt: null },
      });
      if (!process) {
        throw new NotFoundError("Proceso de manufactura no encontrado");
      }
      if (process.status !== "ACTIVE") {
        throw new ValidationError(
          "No se puede seleccionar un proceso inactivo"
        );
      }
      processNameSnapshot = process.name;
      unitSnapshot = process.unit;
    }

    if (!processNameSnapshot) {
      throw new ValidationError(
        "El nombre del proceso es requerido en manufactura"
      );
    }
    if (!unitSnapshot) {
      throw new ValidationError(
        "La unidad del proceso es requerida en manufactura"
      );
    }

    const quantity = Number(row.quantity) || 0;
    const unitRate = Number(row.unitRate) || 0;
    result.push({
      manufacturingProcessId: row.manufacturingProcessId || null,
      processNameSnapshot,
      unitSnapshot,
      quantity,
      unitRate,
      amount: lineAmount(quantity, unitRate),
      observations: row.observations ?? null,
      sortOrder: row.sortOrder ?? i,
    });
  }
  return result;
}

async function resolveMaterialRows(tx, rows = []) {
  const result = [];
  for (const row of rows) {
    let descriptionSnapshot = row.descriptionSnapshot || null;
    let unit = row.unit ?? null;
    let presentation = row.presentation ?? null;
    let dimensions = row.dimensions ?? null;

    if (row.itemId) {
      const item = await tx.item.findFirst({
        where: { id: row.itemId, deletedAt: null },
      });
      if (!item) throw new NotFoundError("Item de material no encontrado");
      if (item.status !== "ACTIVE") {
        throw new ValidationError("No se puede seleccionar un item inactivo");
      }
      if (!descriptionSnapshot) descriptionSnapshot = item.name;
      if (!unit) unit = item.unitOfMeasure ?? null;
    }

    if (row.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: row.supplierId, deletedAt: null },
      });
      if (!supplier) throw new NotFoundError("Proveedor no encontrado");
      if (supplier.status !== "ACTIVE") {
        throw new ValidationError(
          "No se puede seleccionar un proveedor inactivo"
        );
      }
    }

    if (!descriptionSnapshot) {
      throw new ValidationError(
        "La descripcion del material es requerida"
      );
    }

    const quantity = Number(row.quantity) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    result.push({
      itemId: row.itemId || null,
      supplierId: row.supplierId || null,
      descriptionSnapshot,
      dimensions,
      presentation,
      unit,
      quantity,
      unitPrice,
      amount: lineAmount(quantity, unitPrice),
      observations: row.observations ?? null,
    });
  }
  return result;
}

async function resolveExtraRows(tx, rows = []) {
  const result = [];
  for (const row of rows) {
    if (row.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: row.supplierId, deletedAt: null },
      });
      if (!supplier) throw new NotFoundError("Proveedor no encontrado");
      if (supplier.status !== "ACTIVE") {
        throw new ValidationError(
          "No se puede seleccionar un proveedor inactivo"
        );
      }
    }
    const quantity = Number(row.quantity) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    result.push({
      description: row.description,
      quantity,
      unit: row.unit ?? null,
      unitPrice,
      amount: lineAmount(quantity, unitPrice),
      supplierId: row.supplierId || null,
      observations: row.observations ?? null,
    });
  }
  return result;
}

async function resolveInstallationRows(tx, rows = []) {
  const result = [];
  for (const row of rows) {
    let conceptNameSnapshot = row.conceptNameSnapshot || null;
    let unitSnapshot = row.unitSnapshot || null;

    if (row.installationConceptId) {
      const concept = await tx.installationConcept.findFirst({
        where: { id: row.installationConceptId, deletedAt: null },
      });
      if (!concept) {
        throw new NotFoundError("Concepto de instalacion no encontrado");
      }
      if (concept.status !== "ACTIVE") {
        throw new ValidationError(
          "No se puede seleccionar un concepto inactivo"
        );
      }
      conceptNameSnapshot = concept.name;
      unitSnapshot = concept.unit;
    }

    if (!conceptNameSnapshot) {
      throw new ValidationError(
        "El nombre del concepto de instalacion es requerido"
      );
    }
    if (!unitSnapshot) {
      throw new ValidationError(
        "La unidad del concepto de instalacion es requerida"
      );
    }

    const quantity = Number(row.quantity) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    result.push({
      installationConceptId: row.installationConceptId || null,
      conceptNameSnapshot,
      unitSnapshot,
      quantity,
      unitPrice,
      amount: lineAmount(quantity, unitPrice),
      observations: row.observations ?? null,
    });
  }
  return result;
}

async function nextItemPosition(tx, quoteId) {
  const agg = await tx.quoteItem.aggregate({
    where: { quoteId },
    _max: { position: true },
  });
  return (agg._max.position || 0) + 1;
}

function mapChildCreates(resolved) {
  return {
    manufacturing: { create: resolved.manufacturing },
    materials: { create: resolved.materials },
    extras: { create: resolved.extras },
    installations: { create: resolved.installations },
  };
}

export async function listQuotes(request) {
  await requirePermission("quotes.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  const where = { deletedAt: null };
  if (QUOTE_STATUSES.includes(params.status)) {
    where.status = params.status;
  }

  const clientId = params.searchParams.get("clientId");
  if (clientId) where.clientId = clientId;

  const sellerId = params.searchParams.get("sellerId");
  if (sellerId) where.sellerId = sellerId;

  if (params.q) {
    where.OR = [
      { folio: { contains: params.q, mode: "insensitive" } },
      { purchaseOrder: { contains: params.q, mode: "insensitive" } },
      { requisition: { contains: params.q, mode: "insensitive" } },
      {
        client: {
          commercialName: { contains: params.q, mode: "insensitive" },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: LIST_INCLUDE,
    }),
    prisma.quote.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getQuote(request, id) {
  await requirePermission("quotes.view");
  const record = await findQuoteOrThrow(id, DETAIL_INCLUDE);
  return jsonOk(record);
}

export async function createQuote(request) {
  await requirePermission("quotes.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = quoteCreateSchema.parse(body);

  if (data.validUntil < data.elaborationDate) {
    throw new ValidationError(
      "La vigencia debe ser posterior o igual a la fecha de elaboracion"
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
    const folio = await generateFolio(tx, "QUOTE", data.elaborationDate);
    return tx.quote.create({
      data: {
        folio,
        clientId: data.clientId,
        clientContactId: data.clientContactId || null,
        sellerId,
        issuingCompanyId: data.issuingCompanyId,
        orderType: data.orderType,
        currency: data.currency,
        elaborationDate: data.elaborationDate,
        requestDate: data.requestDate || null,
        validUntil: data.validUntil,
        purchaseOrder: data.purchaseOrder ?? null,
        requisition: data.requisition ?? null,
        internalObservations: data.internalObservations ?? null,
        clientDesignProvided: data.clientDesignProvided,
        advancePercentage: data.advancePercentage,
        settlementPercentage: data.settlementPercentage,
        paymentNotes: data.paymentNotes ?? null,
        status: "DRAFT",
        createdBy: actor.id,
        updatedBy: actor.id,
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function updateQuote(request, id) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const existing = await findQuoteOrThrow(id, DETAIL_INCLUDE);
  assertDraft(existing);

  const body = await request.json();
  const data = quoteUpdateSchema.parse(body);

  const elaborationDate = data.elaborationDate ?? existing.elaborationDate;
  const validUntil = data.validUntil ?? existing.validUntil;
  if (validUntil < elaborationDate) {
    throw new ValidationError(
      "La vigencia debe ser posterior o igual a la fecha de elaboracion"
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

  const record = await prisma.quote.update({
    where: { id },
    data: {
      ...data,
      updatedBy: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function removeQuote(request, id) {
  await requirePermission("quotes.delete_draft");
  const actor = await getActor(request);
  const existing = await findQuoteOrThrow(id);
  assertDraft(existing);

  await prisma.quote.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });

  return jsonOk({ ok: true });
}

export async function upsertQuoteItem(request, quoteId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  assertDraft(quote);

  const body = await request.json();
  const data = quoteItemUpsertSchema.parse(body);

  if (Number(data.benefitPercentage) < MIN_BENEFIT_SALES) {
    await requirePermission("quotes.edit_benefit");
  }
  if (Number(data.discountPercentage) > 0) {
    await requirePermission("quotes.apply_discount");
  }

  if (data.itemId) {
    const catalogItem = await prisma.item.findFirst({
      where: { id: data.itemId, deletedAt: null },
    });
    if (!catalogItem) throw new NotFoundError("Item de catalogo no encontrado");
    if (catalogItem.status !== "ACTIVE") {
      throw new ValidationError("No se puede seleccionar un item inactivo");
    }
  }

  if (data.warehouseId) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundError("Almacen no encontrado");
    if (warehouse.status !== "ACTIVE") {
      throw new ValidationError("No se puede seleccionar un almacen inactivo");
    }
  }

  if (data.templateId) {
    const template = await prisma.quoteItemTemplate.findFirst({
      where: { id: data.templateId, deletedAt: null },
    });
    if (!template) throw new NotFoundError("Plantilla no encontrada");
  }

  const record = await prisma.$transaction(async (tx) => {
    const manufacturing = await resolveManufacturingRows(tx, data.manufacturing);
    const materials = await resolveMaterialRows(tx, data.materials);
    const extras = await resolveExtraRows(tx, data.extras);
    const installations = await resolveInstallationRows(
      tx,
      data.installations
    );

    const itemFields = {
      templateId: data.templateId || null,
      itemId: data.itemId || null,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit ?? null,
      deliveryTimeMin: data.deliveryTimeMin ?? null,
      deliveryTimeMax: data.deliveryTimeMax ?? null,
      deliveryTimeUnit: data.deliveryTimeUnit ?? null,
      deliveryDaysType: data.deliveryDaysType ?? null,
      clientObservations: data.clientObservations ?? null,
      internalObservations: data.internalObservations ?? null,
      benefitPercentage: data.benefitPercentage,
      discountPercentage: data.discountPercentage,
      isUrgent: data.isUrgent,
      warehouseId: data.warehouseId || null,
    };

    let itemId = data.id || null;
    if (itemId) {
      const existingItem = await tx.quoteItem.findFirst({
        where: { id: itemId, quoteId },
      });
      if (!existingItem) {
        throw new NotFoundError("Item de cotizacion no encontrado");
      }

      await tx.quoteItemManufacturing.deleteMany({
        where: { quoteItemId: itemId },
      });
      await tx.quoteItemMaterial.deleteMany({ where: { quoteItemId: itemId } });
      await tx.quoteItemExtra.deleteMany({ where: { quoteItemId: itemId } });
      await tx.quoteItemInstallation.deleteMany({
        where: { quoteItemId: itemId },
      });

      await tx.quoteItem.update({
        where: { id: itemId },
        data: {
          ...itemFields,
          ...mapChildCreates({
            manufacturing,
            materials,
            extras,
            installations,
          }),
        },
      });
    } else {
      const position = await nextItemPosition(tx, quoteId);
      const created = await tx.quoteItem.create({
        data: {
          quoteId,
          position,
          ...itemFields,
          ...mapChildCreates({
            manufacturing,
            materials,
            extras,
            installations,
          }),
        },
      });
      itemId = created.id;
    }

    return recalculateQuote(tx, quoteId);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: quoteId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: quote,
    newData: record,
  });

  return jsonOk(record);
}

export async function deleteQuoteItem(request, quoteId, itemId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  assertDraft(quote);

  const item = await prisma.quoteItem.findFirst({
    where: { id: itemId, quoteId },
  });
  if (!item) throw new NotFoundError("Item de cotizacion no encontrado");

  const record = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.delete({ where: { id: itemId } });
    return recalculateQuote(tx, quoteId);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: quoteId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: quote,
    newData: record,
  });

  return jsonOk(record);
}

export async function toggleQuoteItemStatus(request, quoteId, itemId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  // Permitir activar/desactivar en borrador; en otros estatus solo lectura de totales
  // Admin puede desactivar incluso en APPROVED antes de producción vía revisión (fase 2).
  // Fase 1: solo DRAFT para toggle (consistente con edición).
  assertDraft(quote);

  const item = await prisma.quoteItem.findFirst({
    where: { id: itemId, quoteId },
  });
  if (!item) throw new NotFoundError("Item de cotizacion no encontrado");

  const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  const record = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.update({
      where: { id: itemId },
      data: { status: nextStatus },
    });
    return recalculateQuote(tx, quoteId);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "QuoteItem",
    entityId: itemId,
    action: nextStatus === "ACTIVE" ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
    previousData: { status: item.status },
    newData: { status: nextStatus },
  });

  return jsonOk(record);
}

export async function saveQuoteItemToLibrary(request, quoteId, itemId) {
  await requirePermission("quote_templates.create");
  const actor = await getActor(request);

  const item = await prisma.quoteItem.findFirst({
    where: { id: itemId, quoteId },
    include: {
      manufacturing: { orderBy: { sortOrder: "asc" } },
      materials: true,
      extras: true,
      installations: true,
    },
  });
  if (!item) throw new NotFoundError("Item de cotizacion no encontrado");

  const observations = [item.internalObservations, item.clientObservations]
    .filter(Boolean)
    .join("\n")
    .trim() || null;

  const template = await prisma.quoteItemTemplate.create({
    data: {
      name: item.description.slice(0, 200),
      description: item.description,
      defaultQuantity: item.quantity,
      unit: item.unit,
      deliveryTimeMin: item.deliveryTimeMin,
      deliveryTimeMax: item.deliveryTimeMax,
      deliveryTimeUnit: item.deliveryTimeUnit,
      deliveryDaysType: item.deliveryDaysType,
      observations,
      benefitPercentage: item.benefitPercentage,
      itemId: item.itemId,
      status: "ACTIVE",
      createdBy: actor.id,
      updatedBy: actor.id,
      manufacturing: {
        create: item.manufacturing.map((r, i) => ({
          manufacturingProcessId: r.manufacturingProcessId,
          processNameSnapshot: r.processNameSnapshot,
          unitSnapshot: r.unitSnapshot,
          quantity: r.quantity,
          unitRate: r.unitRate,
          amount: r.amount,
          observations: r.observations,
          sortOrder: r.sortOrder ?? i,
        })),
      },
      materials: {
        create: item.materials.map((r) => ({
          itemId: r.itemId,
          supplierId: r.supplierId,
          descriptionSnapshot: r.descriptionSnapshot,
          dimensions: r.dimensions,
          presentation: r.presentation,
          unit: r.unit,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          amount: r.amount,
          observations: r.observations,
        })),
      },
      extras: {
        create: item.extras.map((r) => ({
          description: r.description,
          quantity: r.quantity,
          unit: r.unit,
          unitPrice: r.unitPrice,
          amount: r.amount,
          supplierId: r.supplierId,
          observations: r.observations,
        })),
      },
      installations: {
        create: item.installations.map((r) => ({
          installationConceptId: r.installationConceptId,
          conceptNameSnapshot: r.conceptNameSnapshot,
          unitSnapshot: r.unitSnapshot,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          amount: r.amount,
          observations: r.observations,
        })),
      },
    },
    include: {
      manufacturing: true,
      materials: true,
      extras: true,
      installations: true,
    },
  });

  await prisma.quoteItem.update({
    where: { id: itemId },
    data: { templateId: template.id },
  });

  await recordAudit({
    actor,
    module: "quote_templates",
    entity: "QuoteItemTemplate",
    entityId: template.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: template,
  });

  return jsonCreated(template);
}

export async function duplicateQuoteItem(request, quoteId, itemId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  assertDraft(quote);

  const source = await prisma.quoteItem.findFirst({
    where: { id: itemId, quoteId },
    include: {
      manufacturing: true,
      materials: true,
      extras: true,
      installations: true,
    },
  });
  if (!source) throw new NotFoundError("Item de cotizacion no encontrado");

  const record = await prisma.$transaction(async (tx) => {
    const position = await nextItemPosition(tx, quoteId);
    await tx.quoteItem.create({
      data: {
        quoteId,
        position,
        templateId: source.templateId,
        itemId: source.itemId,
        description: source.description,
        quantity: source.quantity,
        unit: source.unit,
        deliveryTimeMin: source.deliveryTimeMin,
        deliveryTimeMax: source.deliveryTimeMax,
        deliveryTimeUnit: source.deliveryTimeUnit,
        deliveryDaysType: source.deliveryDaysType,
        clientObservations: source.clientObservations,
        internalObservations: source.internalObservations,
        benefitPercentage: source.benefitPercentage,
        discountPercentage: source.discountPercentage,
        isUrgent: source.isUrgent,
        warehouseId: source.warehouseId,
        manufacturing: {
          create: source.manufacturing.map((r) => ({
            manufacturingProcessId: r.manufacturingProcessId,
            processNameSnapshot: r.processNameSnapshot,
            unitSnapshot: r.unitSnapshot,
            quantity: r.quantity,
            unitRate: r.unitRate,
            amount: r.amount,
            observations: r.observations,
            sortOrder: r.sortOrder,
          })),
        },
        materials: {
          create: source.materials.map((r) => ({
            itemId: r.itemId,
            supplierId: r.supplierId,
            descriptionSnapshot: r.descriptionSnapshot,
            dimensions: r.dimensions,
            presentation: r.presentation,
            unit: r.unit,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            amount: r.amount,
            observations: r.observations,
          })),
        },
        extras: {
          create: source.extras.map((r) => ({
            description: r.description,
            quantity: r.quantity,
            unit: r.unit,
            unitPrice: r.unitPrice,
            amount: r.amount,
            supplierId: r.supplierId,
            observations: r.observations,
          })),
        },
        installations: {
          create: source.installations.map((r) => ({
            installationConceptId: r.installationConceptId,
            conceptNameSnapshot: r.conceptNameSnapshot,
            unitSnapshot: r.unitSnapshot,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            amount: r.amount,
            observations: r.observations,
          })),
        },
      },
    });
    return recalculateQuote(tx, quoteId);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: quoteId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: quote,
    newData: record,
  });

  return jsonOk(record);
}

export async function insertFromTemplate(request, quoteId, templateId) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  assertDraft(quote);

  const resolvedTemplateId =
    templateId ||
    insertTemplateSchema.parse(await request.json()).templateId;

  const template = await prisma.quoteItemTemplate.findFirst({
    where: { id: resolvedTemplateId, deletedAt: null },
    include: {
      manufacturing: { orderBy: { sortOrder: "asc" } },
      materials: true,
      extras: true,
      installations: true,
    },
  });
  if (!template) throw new NotFoundError("Plantilla no encontrada");
  if (template.status !== "ACTIVE") {
    throw new ValidationError("No se puede usar una plantilla inactiva");
  }

  const record = await prisma.$transaction(async (tx) => {
    const position = await nextItemPosition(tx, quoteId);
    await tx.quoteItem.create({
      data: {
        quoteId,
        position,
        templateId: template.id,
        itemId: template.itemId,
        description: template.name,
        quantity: template.defaultQuantity,
        unit: template.unit,
        deliveryTimeMin: template.deliveryTimeMin,
        deliveryTimeMax: template.deliveryTimeMax,
        deliveryTimeUnit: template.deliveryTimeUnit,
        deliveryDaysType: template.deliveryDaysType,
        internalObservations: template.observations,
        benefitPercentage: template.benefitPercentage,
        manufacturing: {
          create: template.manufacturing.map((r) => ({
            manufacturingProcessId: r.manufacturingProcessId,
            processNameSnapshot: r.processNameSnapshot,
            unitSnapshot: r.unitSnapshot,
            quantity: r.quantity,
            unitRate: r.unitRate,
            amount: r.amount,
            observations: r.observations,
            sortOrder: r.sortOrder,
          })),
        },
        materials: {
          create: template.materials.map((r) => ({
            itemId: r.itemId,
            supplierId: r.supplierId,
            descriptionSnapshot: r.descriptionSnapshot,
            dimensions: r.dimensions,
            presentation: r.presentation,
            unit: r.unit,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            amount: r.amount,
            observations: r.observations,
          })),
        },
        extras: {
          create: template.extras.map((r) => ({
            description: r.description,
            quantity: r.quantity,
            unit: r.unit,
            unitPrice: r.unitPrice,
            amount: r.amount,
            supplierId: r.supplierId,
            observations: r.observations,
          })),
        },
        installations: {
          create: template.installations.map((r) => ({
            installationConceptId: r.installationConceptId,
            conceptNameSnapshot: r.conceptNameSnapshot,
            unitSnapshot: r.unitSnapshot,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            amount: r.amount,
            observations: r.observations,
          })),
        },
      },
    });
    return recalculateQuote(tx, quoteId);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: quoteId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: quote,
    newData: record,
  });

  return jsonOk(record);
}

export async function reorderItems(request, quoteId, orderedIds) {
  await requirePermission("quotes.edit");
  const actor = await getActor(request);
  const quote = await findQuoteOrThrow(quoteId);
  assertDraft(quote);

  const ids =
    orderedIds ||
    reorderItemsSchema.parse(await request.json()).orderedIds;

  const items = await prisma.quoteItem.findMany({
    where: { quoteId },
    select: { id: true },
  });
  const existingIds = new Set(items.map((i) => i.id));
  if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
    throw new ValidationError(
      "La lista de items no coincide con los de la cotizacion"
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i += 1) {
      await tx.quoteItem.update({
        where: { id: ids[i] },
        data: { position: i + 1 },
      });
    }
    return tx.quote.findFirst({
      where: { id: quoteId },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: quoteId,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: quote,
    newData: record,
  });

  return jsonOk(record);
}

async function transitionQuote(request, id, {
  permission,
  toStatus,
  auditAction,
  applyData,
  parseBody,
}) {
  await requirePermission(permission);
  const actor = await getActor(request);
  const existing = await findQuoteOrThrow(id, DETAIL_INCLUDE);
  assertTransition(existing.status, toStatus);

  let bodyData = null;
  if (parseBody) {
    const body = await request.json();
    bodyData = parseBody(body);
  }

  const extra = applyData
    ? await applyData({ actor, existing, bodyData })
    : {};

  const record = await prisma.quote.update({
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
    module: "quotes",
    entity: "Quote",
    entityId: id,
    action: auditAction,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function submitQuote(request, id) {
  return transitionQuote(request, id, {
    permission: "quotes.submit",
    toStatus: "PENDING_APPROVAL",
    auditAction: AUDIT_ACTIONS.SUBMIT,
  });
}

export async function approveQuote(request, id) {
  return transitionQuote(request, id, {
    permission: "quotes.approve",
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
}

export async function rejectQuote(request, id) {
  return transitionQuote(request, id, {
    permission: "quotes.reject",
    toStatus: "REJECTED",
    auditAction: AUDIT_ACTIONS.REJECT,
    parseBody: (body) => quoteRejectSchema.parse(body),
    applyData: async ({ actor, bodyData }) => ({
      rejectedBy: actor.id,
      rejectedAt: new Date(),
      rejectionReason: bodyData.reason,
      approvedBy: null,
      approvedAt: null,
    }),
  });
}

export async function returnToDraft(request, id) {
  return transitionQuote(request, id, {
    permission: "quotes.return_to_draft",
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

export async function cancelQuote(request, id) {
  return transitionQuote(request, id, {
    permission: "quotes.cancel",
    toStatus: "CANCELLED",
    auditAction: AUDIT_ACTIONS.CANCEL,
    parseBody: (body) => quoteCancelSchema.parse(body),
    applyData: async ({ actor, bodyData }) => ({
      cancelledBy: actor.id,
      cancelledAt: new Date(),
      cancellationReason: bodyData.reason,
    }),
  });
}

export async function createQuoteRevision(request, id) {
  await requirePermission("quotes.create");
  const actor = await getActor(request);
  const source = await findQuoteOrThrow(id, {
    items: {
      orderBy: { position: "asc" },
      include: {
        manufacturing: { orderBy: { sortOrder: "asc" } },
        materials: true,
        extras: true,
        installations: true,
      },
    },
  });

  if (!["APPROVED", "IN_PRODUCTION"].includes(source.status)) {
    throw new ConflictError(
      "Solo se puede versionar una cotizacion aprobada o en produccion"
    );
  }

  const match = String(source.folio).match(/^(.*)-([A-Z])$/i);
  const base = match ? match[1] : source.folio;
  const currentLetter = (match ? match[2] : source.version || "A").toUpperCase();
  const nextLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
  if (nextLetter > "Z") {
    throw new ValidationError("Se alcanzo el limite de versiones (Z)");
  }
  const newFolio = `${base}-${nextLetter}`;

  const existingFolio = await prisma.quote.findUnique({
    where: { folio: newFolio },
    select: { id: true },
  });
  if (existingFolio) {
    throw new ConflictError(`Ya existe la version ${newFolio}`);
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        folio: newFolio,
        version: nextLetter,
        parentQuoteId: source.id,
        clientId: source.clientId,
        clientContactId: source.clientContactId,
        sellerId: source.sellerId,
        issuingCompanyId: source.issuingCompanyId,
        orderType: source.orderType,
        currency: source.currency,
        elaborationDate: new Date(),
        requestDate: source.requestDate,
        validUntil: source.validUntil,
        purchaseOrder: source.purchaseOrder,
        requisition: source.requisition,
        internalObservations: source.internalObservations,
        clientDesignProvided: source.clientDesignProvided,
        advancePercentage: source.advancePercentage,
        settlementPercentage: source.settlementPercentage,
        paymentNotes: source.paymentNotes,
        status: "DRAFT",
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: source.items.map((item) => ({
            position: item.position,
            templateId: item.templateId,
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            deliveryTimeMin: item.deliveryTimeMin,
            deliveryTimeMax: item.deliveryTimeMax,
            deliveryTimeUnit: item.deliveryTimeUnit,
            deliveryDaysType: item.deliveryDaysType,
            clientObservations: item.clientObservations,
            internalObservations: item.internalObservations,
            benefitPercentage: item.benefitPercentage,
            discountPercentage: item.discountPercentage,
            isUrgent: item.isUrgent,
            warehouseId: item.warehouseId,
            status: item.status,
            originItemId: item.originItemId || item.id,
            manufacturing: {
              create: item.manufacturing.map((r) => ({
                manufacturingProcessId: r.manufacturingProcessId,
                processNameSnapshot: r.processNameSnapshot,
                unitSnapshot: r.unitSnapshot,
                quantity: r.quantity,
                unitRate: r.unitRate,
                amount: r.amount,
                observations: r.observations,
                sortOrder: r.sortOrder,
              })),
            },
            materials: {
              create: item.materials.map((r) => ({
                itemId: r.itemId,
                supplierId: r.supplierId,
                descriptionSnapshot: r.descriptionSnapshot,
                dimensions: r.dimensions,
                presentation: r.presentation,
                unit: r.unit,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                amount: r.amount,
                observations: r.observations,
              })),
            },
            extras: {
              create: item.extras.map((r) => ({
                description: r.description,
                quantity: r.quantity,
                unit: r.unit,
                unitPrice: r.unitPrice,
                amount: r.amount,
                supplierId: r.supplierId,
                observations: r.observations,
              })),
            },
            installations: {
              create: item.installations.map((r) => ({
                installationConceptId: r.installationConceptId,
                conceptNameSnapshot: r.conceptNameSnapshot,
                unitSnapshot: r.unitSnapshot,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                amount: r.amount,
                observations: r.observations,
              })),
            },
          })),
        },
      },
    });
    return recalculateQuote(tx, created.id);
  });

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: { folio: record.folio, parentQuoteId: source.id, revision: true },
  });

  return jsonCreated(record);
}

export async function sendToProduction(request, id) {
  await requirePermission("quotes.send_to_production");
  const actor = await getActor(request);
  const existing = await findQuoteOrThrow(id, {
    ...DETAIL_INCLUDE,
    items: { orderBy: { position: "asc" } },
  });

  if (existing.status !== "APPROVED" && existing.status !== "IN_PRODUCTION") {
    throw new ConflictError(
      "Solo se pueden enviar a produccion cotizaciones aprobadas o en produccion (nuevas partidas)"
    );
  }

  const activeItems = (existing.items || []).filter((i) => i.status === "ACTIVE");
  if (!activeItems.length) {
    throw new ValidationError(
      "No hay partidas activas para enviar a produccion"
    );
  }

  // Cobertura: IDs de esta cotización + originItemId (línea de versiones previas)
  const lineageIds = [
    existing.id,
    existing.parentQuoteId,
  ].filter(Boolean);

  const priorOps = await prisma.productionOrder.findMany({
    where: {
      OR: [
        { quoteId: { in: lineageIds } },
        { id: existing.productionOrderId || "__none__" },
      ],
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      items: { select: { sourceItemId: true } },
    },
  });

  const coveredSourceIds = new Set();
  for (const op of priorOps) {
    for (const it of op.items) {
      coveredSourceIds.add(it.sourceItemId);
    }
  }

  const itemsToSend = activeItems.filter((item) => {
    if (coveredSourceIds.has(item.id)) return false;
    if (item.originItemId && coveredSourceIds.has(item.originItemId)) return false;
    return true;
  });

  if (!itemsToSend.length) {
    throw new ConflictError(
      "Todas las partidas activas ya estan cubiertas por ordenes de produccion"
    );
  }

  if (existing.status === "APPROVED") {
    assertTransition(existing.status, "IN_PRODUCTION");
  }

  const record = await prisma.$transaction(async (tx) => {
    const folio = await generateFolio(tx, "PRODUCTION");
    const productionOrder = await tx.productionOrder.create({
      data: {
        folio,
        sourceType: "QUOTE",
        clientId: existing.clientId,
        quoteId: existing.id,
        approvalDate: existing.approvedAt || new Date(),
        status: "PENDING",
        totalItems: itemsToSend.length,
        completedItems: 0,
        progressPercentage: 0,
        createdBy: actor.id,
        updatedBy: actor.id,
        items: {
          create: itemsToSend.map((item) => ({
            sourceItemId: item.id,
            sourceItemType: "QUOTE_ITEM",
            position: item.position,
            description: item.description,
            quantity: item.quantity,
            status: "PENDING",
          })),
        },
      },
    });

    return tx.quote.update({
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
    module: "quotes",
    entity: "Quote",
    entityId: id,
    action: AUDIT_ACTIONS.SEND_TO_PRODUCTION,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}
