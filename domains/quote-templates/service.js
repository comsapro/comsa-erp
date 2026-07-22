import "server-only";
import { prisma } from "@/lib/db";
import { parseListParams, paginated } from "@/lib/api/list-params";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  ValidationError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { lineAmount } from "@/lib/quotes/calculations";
import {
  quoteTemplateCreateSchema,
  quoteTemplateUpdateSchema,
} from "./schemas";

const SORTABLE = ["name", "category", "status", "createdAt", "updatedAt"];

const DETAIL_INCLUDE = {
  item: { select: { id: true, sku: true, name: true } },
  manufacturing: { orderBy: { sortOrder: "asc" } },
  materials: true,
  extras: true,
  installations: true,
};

async function findTemplateOrThrow(id, include = DETAIL_INCLUDE) {
  const record = await prisma.quoteItemTemplate.findFirst({
    where: { id, deletedAt: null },
    include,
  });
  if (!record) throw new NotFoundError("Plantilla no encontrada");
  return record;
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
      throw new ValidationError("La descripcion del material es requerida");
    }

    const quantity = Number(row.quantity) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    result.push({
      itemId: row.itemId || null,
      supplierId: row.supplierId || null,
      descriptionSnapshot,
      dimensions: row.dimensions ?? null,
      presentation: row.presentation ?? null,
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

async function resolveChildren(tx, data) {
  return {
    manufacturing: await resolveManufacturingRows(tx, data.manufacturing || []),
    materials: await resolveMaterialRows(tx, data.materials || []),
    extras: await resolveExtraRows(tx, data.extras || []),
    installations: await resolveInstallationRows(tx, data.installations || []),
  };
}

function baseFields(data) {
  return {
    name: data.name,
    category: data.category ?? null,
    description: data.description ?? null,
    defaultQuantity: data.defaultQuantity,
    unit: data.unit ?? null,
    deliveryTimeMin: data.deliveryTimeMin ?? null,
    deliveryTimeMax: data.deliveryTimeMax ?? null,
    deliveryTimeUnit: data.deliveryTimeUnit ?? null,
    deliveryDaysType: data.deliveryDaysType ?? null,
    observations: data.observations ?? null,
    benefitPercentage: data.benefitPercentage,
    itemId: data.itemId || null,
    status: data.status,
  };
}

export async function listTemplates(request) {
  await requirePermission("quote_templates.view");
  const params = parseListParams(request, {
    allowedSort: SORTABLE,
    defaultSort: "name",
    defaultOrder: "asc",
  });

  const where = { deletedAt: null };
  if (params.status === "ACTIVE" || params.status === "INACTIVE") {
    where.status = params.status;
  }

  const category = params.searchParams.get("category");
  if (category) {
    where.category = { equals: category, mode: "insensitive" };
  }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { category: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.quoteItemTemplate.findMany({
      where,
      orderBy: { [params.sort]: params.order },
      skip: params.skip,
      take: params.take,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        _count: {
          select: {
            manufacturing: true,
            materials: true,
            extras: true,
            installations: true,
          },
        },
      },
    }),
    prisma.quoteItemTemplate.count({ where }),
  ]);

  return jsonOk(paginated(rows, total, params));
}

export async function getTemplate(request, id) {
  await requirePermission("quote_templates.view");
  const record = await findTemplateOrThrow(id);
  return jsonOk(record);
}

export async function createTemplate(request) {
  await requirePermission("quote_templates.create");
  const actor = await getActor(request);
  const body = await request.json();
  const data = quoteTemplateCreateSchema.parse(body);

  if (data.itemId) {
    const item = await prisma.item.findFirst({
      where: { id: data.itemId, deletedAt: null },
    });
    if (!item) throw new NotFoundError("Item de catalogo no encontrado");
    if (item.status !== "ACTIVE") {
      throw new ValidationError("No se puede seleccionar un item inactivo");
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const children = await resolveChildren(tx, data);
    return tx.quoteItemTemplate.create({
      data: {
        ...baseFields(data),
        createdBy: actor.id,
        updatedBy: actor.id,
        manufacturing: { create: children.manufacturing },
        materials: { create: children.materials },
        extras: { create: children.extras },
        installations: { create: children.installations },
      },
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "quote_templates",
    entity: "QuoteItemTemplate",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}

export async function updateTemplate(request, id) {
  await requirePermission("quote_templates.edit");
  const actor = await getActor(request);
  const existing = await findTemplateOrThrow(id);
  const body = await request.json();
  const data = quoteTemplateUpdateSchema.parse(body);

  if (data.itemId) {
    const item = await prisma.item.findFirst({
      where: { id: data.itemId, deletedAt: null },
    });
    if (!item) throw new NotFoundError("Item de catalogo no encontrado");
    if (item.status !== "ACTIVE") {
      throw new ValidationError("No se puede seleccionar un item inactivo");
    }
  }

  const hasChildren =
    data.manufacturing !== undefined ||
    data.materials !== undefined ||
    data.extras !== undefined ||
    data.installations !== undefined;

  const record = await prisma.$transaction(async (tx) => {
    if (hasChildren) {
      await tx.quoteItemTemplateManufacturing.deleteMany({
        where: { templateId: id },
      });
      await tx.quoteItemTemplateMaterial.deleteMany({
        where: { templateId: id },
      });
      await tx.quoteItemTemplateExtra.deleteMany({
        where: { templateId: id },
      });
      await tx.quoteItemTemplateInstallation.deleteMany({
        where: { templateId: id },
      });
    }

    const children = hasChildren
      ? await resolveChildren(tx, {
          manufacturing: data.manufacturing ?? [],
          materials: data.materials ?? [],
          extras: data.extras ?? [],
          installations: data.installations ?? [],
        })
      : null;

    const {
      manufacturing: _m,
      materials: _mat,
      extras: _e,
      installations: _i,
      ...rest
    } = data;

    return tx.quoteItemTemplate.update({
      where: { id },
      data: {
        ...rest,
        updatedBy: actor.id,
        ...(children
          ? {
              manufacturing: { create: children.manufacturing },
              materials: { create: children.materials },
              extras: { create: children.extras },
              installations: { create: children.installations },
            }
          : {}),
      },
      include: DETAIL_INCLUDE,
    });
  });

  let action = AUDIT_ACTIONS.UPDATE;
  if (data.status && data.status !== existing.status) {
    action =
      data.status === "ACTIVE"
        ? AUDIT_ACTIONS.ACTIVATE
        : AUDIT_ACTIONS.DEACTIVATE;
  }

  await recordAudit({
    actor,
    module: "quote_templates",
    entity: "QuoteItemTemplate",
    entityId: id,
    action,
    previousData: existing,
    newData: record,
  });

  return jsonOk(record);
}

export async function removeTemplate(request, id) {
  await requirePermission("quote_templates.delete");
  const actor = await getActor(request);
  const existing = await findTemplateOrThrow(id, undefined);

  await prisma.quoteItemTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    module: "quote_templates",
    entity: "QuoteItemTemplate",
    entityId: id,
    action: AUDIT_ACTIONS.DELETE,
    previousData: existing,
  });

  return jsonOk({ ok: true });
}

export async function duplicateTemplate(request, id) {
  await requirePermission("quote_templates.create");
  const actor = await getActor(request);
  const source = await findTemplateOrThrow(id);

  const record = await prisma.$transaction(async (tx) => {
    return tx.quoteItemTemplate.create({
      data: {
        name: `${source.name} (copia)`,
        category: source.category,
        description: source.description,
        defaultQuantity: source.defaultQuantity,
        unit: source.unit,
        deliveryTimeMin: source.deliveryTimeMin,
        deliveryTimeMax: source.deliveryTimeMax,
        deliveryTimeUnit: source.deliveryTimeUnit,
        deliveryDaysType: source.deliveryDaysType,
        observations: source.observations,
        benefitPercentage: source.benefitPercentage,
        itemId: source.itemId,
        status: source.status,
        createdBy: actor.id,
        updatedBy: actor.id,
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
      include: DETAIL_INCLUDE,
    });
  });

  await recordAudit({
    actor,
    module: "quote_templates",
    entity: "QuoteItemTemplate",
    entityId: record.id,
    action: AUDIT_ACTIONS.CREATE,
    newData: record,
  });

  return jsonCreated(record);
}
