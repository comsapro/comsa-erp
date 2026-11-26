import "server-only";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/api/actor";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/require-permission";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { jsonOk, jsonCreated } from "@/lib/api/http";
import { resolveSalesScope, canAccessInvoice } from "@/domains/sales/scope";
import { invoiceCorrectionSchema, invoicePaymentSchema } from "./schemas";
import { CORRECTABLE_INVOICE_FIELDS } from "./constants";
import { addDaysKey, dayKey, keyToDate } from "./periods";
import { getKpiSettings } from "./settings";

/** Dias de credito numericos a partir de las condiciones comerciales del cliente. */
export function parseCreditDays(commercialTerms) {
  if (commercialTerms == null) return null;
  const match = String(commercialTerms).trim().match(/^(\d{1,4})$/);
  return match ? Number(match[1]) : null;
}

export function computeDueDate(receptionDate, creditDays) {
  const reception = dayKey(receptionDate);
  if (!reception || creditDays == null) return null;
  return keyToDate(addDaysKey(reception, Number(creditDays)));
}

/**
 * Campos derivados para crear/editar factura: cliente (de la primera
 * cotizacion), dias de credito (captura > cliente > configuracion) y fecha
 * limite (recepcion + credito).
 */
export async function deriveInvoiceFields({ quoteLinks = [], data, existing = null }) {
  // Sin cotizacion el cliente se captura en el formulario.
  let clientId = (!quoteLinks.length && data.clientId) || existing?.clientId || null;
  let clientTerms = null;
  if (quoteLinks.length) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteLinks[0].quoteId },
      select: { clientId: true, client: { select: { commercialTerms: true } } },
    });
    clientId = quote?.clientId || clientId;
    clientTerms = quote?.client?.commercialTerms ?? null;
  } else if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId },
      select: { commercialTerms: true },
    });
    clientTerms = client?.commercialTerms ?? null;
  }

  let creditDays =
    data.creditDays != null && data.creditDays !== ""
      ? Number(data.creditDays)
      : existing?.creditDays ?? parseCreditDays(clientTerms);
  if (creditDays == null || !Number.isFinite(creditDays)) {
    creditDays = (await getKpiSettings()).defaultCreditDays;
  }

  const receptionDate = data.receivedByClient ? data.receptionDate : null;
  return {
    clientId,
    creditDays,
    sentAt: data.sentAt ? keyToDate(dayKey(data.sentAt)) : null,
    dueDate: computeDueDate(receptionDate, creditDays),
    paidAt: data.paidAt ? keyToDate(dayKey(data.paidAt)) : null,
  };
}

async function loadInvoiceForSeller(request, id) {
  const invoice = await prisma.salesInvoice.findFirst({ where: { id, deletedAt: null } });
  if (!invoice) throw new NotFoundError("Factura no encontrada");
  const scope = await resolveSalesScope(request, {});
  if (!canAccessInvoice(scope, invoice)) {
    throw new ForbiddenError("No puedes editar facturas de otro vendedor");
  }
  return invoice;
}

/** Registrar (o quitar) la fecha real de pago de una factura. */
export async function registerInvoicePayment(request, id) {
  await requirePermission("sales.edit_invoice");
  const actor = await getActor(request);
  const existing = await loadInvoiceForSeller(request, id);
  const data = invoicePaymentSchema.parse(await request.json());

  if (data.paidAt) {
    if (dayKey(existing.invoiceDate) > data.paidAt) {
      throw new ValidationError("La fecha de pago no puede ser anterior a la factura", {
        paidAt: ["Fecha anterior a la factura"],
      });
    }
  }

  const record = await prisma.salesInvoice.update({
    where: { id },
    data: {
      paidAt: data.paidAt ? keyToDate(data.paidAt) : null,
      paymentNotes: data.paymentNotes ?? existing.paymentNotes,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    module: "sales",
    entity: "SalesInvoice",
    entityId: id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: { paidAt: existing.paidAt, paymentNotes: existing.paymentNotes },
    newData: { paidAt: record.paidAt, paymentNotes: record.paymentNotes },
  });

  return jsonOk(record);
}

function serializeValue(value, type) {
  if (value == null) return null;
  if (type === "date") return dayKey(value);
  return String(value);
}

/**
 * Correccion manual auditada de un dato de factura. Nunca sobrescribe en
 * silencio: guarda dato original, nuevo, usuario, fecha y motivo.
 */
export async function correctInvoiceField(request) {
  await requirePermission("kpis.correct_data");
  const actor = await getActor(request);
  const data = invoiceCorrectionSchema.parse(await request.json());
  const def = CORRECTABLE_INVOICE_FIELDS[data.field];

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: data.invoiceId, deletedAt: null },
  });
  if (!invoice) throw new NotFoundError("Factura no encontrada");

  const original = serializeValue(invoice[data.field], def.type);
  const nextSerialized = data.value == null ? null : def.type === "date" ? String(data.value) : String(Number(data.value));
  if (original === nextSerialized) {
    throw new ValidationError("El nuevo valor es igual al actual", { value: ["Sin cambios"] });
  }

  const nextValue =
    data.value == null ? null : def.type === "date" ? keyToDate(String(data.value)) : Number(data.value);

  const patch = { [data.field]: nextValue, updatedBy: actor.id };
  const corrections = [
    { field: data.field, originalValue: original, newValue: nextSerialized, reason: data.reason },
  ];

  if (data.field === "receptionDate") {
    patch.receivedByClient = nextValue != null;
  }

  // Recalcular la fecha limite si cambia recepcion o dias de credito.
  if (data.field === "receptionDate" || data.field === "creditDays") {
    const reception = data.field === "receptionDate" ? nextValue : invoice.receptionDate;
    const credit = data.field === "creditDays" ? nextValue : invoice.creditDays;
    const due = computeDueDate(reception, credit);
    const dueOriginal = serializeValue(invoice.dueDate, "date");
    const dueNext = serializeValue(due, "date");
    if (dueOriginal !== dueNext) {
      patch.dueDate = due;
      corrections.push({
        field: "dueDate",
        originalValue: dueOriginal,
        newValue: dueNext,
        reason: `${data.reason} (recalculada por cambio en ${def.label.toLowerCase()})`,
      });
    }
  }

  const records = await prisma.$transaction(async (tx) => {
    await tx.salesInvoice.update({ where: { id: invoice.id }, data: patch });
    const created = [];
    for (const c of corrections) {
      created.push(
        await tx.dataCorrection.create({
          data: {
            entityType: "SalesInvoice",
            entityId: invoice.id,
            field: c.field,
            originalValue: c.originalValue,
            newValue: c.newValue,
            reason: c.reason,
            correctedBy: actor.id,
          },
        })
      );
    }
    return created;
  });

  await recordAudit({
    actor,
    module: "kpis",
    entity: "SalesInvoice",
    entityId: invoice.id,
    action: AUDIT_ACTIONS.UPDATE,
    previousData: Object.fromEntries(corrections.map((c) => [c.field, c.originalValue])),
    newData: {
      ...Object.fromEntries(corrections.map((c) => [c.field, c.newValue])),
      reason: data.reason,
      correction: true,
    },
  });

  return jsonCreated({ corrections: records });
}

export async function listCorrections(request) {
  await requireAnyPermission(["kpis.view", "kpis.correct_data", "sales.edit_invoice"]);
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType") || "SalesInvoice";
  const entityId = url.searchParams.get("entityId");
  const rows = await prisma.dataCorrection.findMany({
    where: { entityType, ...(entityId ? { entityId } : {}) },
    include: { correctedByUser: { select: { id: true, name: true } } },
    orderBy: { correctedAt: "desc" },
    take: entityId ? 200 : 100,
  });
  return jsonOk({
    data: rows.map((r) => ({
      ...r,
      fieldLabel: CORRECTABLE_INVOICE_FIELDS[r.field]?.label || r.field,
    })),
  });
}
