import { z } from "zod";
import { requiredString, optionalString } from "@/lib/validations/common";
import { PROCESS_UNITS } from "@/domains/catalogs/schemas";
import { ORDER_TYPES, CURRENCIES, DELIVERY_TIME_UNITS, normalizeDeliveryTimeUnit } from "./constants";

const DELIVERY_DAYS_TYPES = ["BUSINESS", "CALENDAR"];

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().min(1).nullable().optional()
);

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().nullable().optional()
);

const quoteHeaderFields = {
  clientId: requiredString("El cliente es requerido"),
  clientContactId: optionalId,
  sellerId: optionalId,
  issuingCompanyId: requiredString("La empresa emisora es requerida"),
  orderType: z.enum(ORDER_TYPES).default("GENERAL"),
  currency: z.enum(CURRENCIES).default("MXN"),
  elaborationDate: z.coerce.date({ message: "Fecha de elaboracion invalida" }),
  requestDate: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.date().nullable().optional()
  ),
  validUntil: z.coerce.date({ message: "Fecha de vigencia invalida" }),
  purchaseOrder: optionalString,
  requisition: optionalString,
  internalObservations: optionalString,
  clientDesignProvided: z.coerce.boolean().default(false),
  advancePercentage: z.coerce.number().min(0).max(100).default(0),
  settlementPercentage: z.coerce.number().min(0).max(100).default(100),
  paymentNotes: optionalString,
};

function refineAdvanceSettlement(data, ctx) {
  if (data.advancePercentage == null || data.settlementPercentage == null) {
    return;
  }
  const advance = Number(data.advancePercentage) || 0;
  const settlement = Number(data.settlementPercentage) || 0;
  if (Math.abs(advance + settlement - 100) > 0.01) {
    ctx.addIssue({
      code: "custom",
      path: ["settlementPercentage"],
      message: "Anticipo y liquidacion deben sumar 100%",
    });
  }
}

export const quoteCreateSchema = z
  .object(quoteHeaderFields)
  .superRefine(refineAdvanceSettlement);

export const quoteUpdateSchema = z
  .object(quoteHeaderFields)
  .partial()
  .superRefine(refineAdvanceSettlement);

export const manufacturingLineSchema = z.object({
  manufacturingProcessId: requiredString("Selecciona un proceso del catalogo"),
  processNameSnapshot: optionalString,
  unitSnapshot: z.enum(PROCESS_UNITS).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitRate: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).optional(),
  observations: optionalString,
  sortOrder: z.coerce.number().int().default(0),
});

export const materialLineSchema = z.object({
  itemId: optionalId,
  supplierId: optionalId,
  descriptionSnapshot: optionalString,
  dimensions: optionalString,
  presentation: optionalString,
  unit: optionalString,
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).optional(),
  observations: optionalString,
});

export const extraLineSchema = z.object({
  description: requiredString("La descripcion del extra es requerida"),
  quantity: z.coerce.number().min(0).default(1),
  unit: optionalString,
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).optional(),
  supplierId: optionalId,
  observations: optionalString,
});

export const installationLineSchema = z.object({
  installationConceptId: optionalId,
  conceptNameSnapshot: optionalString,
  unitSnapshot: z.enum(PROCESS_UNITS).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).optional(),
  observations: optionalString,
});

export const quoteItemUpsertSchema = z.object({
  id: optionalId,
  templateId: optionalId,
  itemId: optionalId,
  description: requiredString("La descripcion del item es requerida", 2000),
  quantity: z.coerce.number().min(0).default(1),
  unit: optionalString,
  deliveryTimeMin: optionalInt,
  deliveryTimeMax: optionalInt,
  deliveryTimeUnit: z.preprocess(
    (v) => {
      if (v === "" || v == null) return null;
      return normalizeDeliveryTimeUnit(v);
    },
    z.enum(DELIVERY_TIME_UNITS).nullable().optional()
  ),
  deliveryDaysType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(DELIVERY_DAYS_TYPES).nullable().optional()
  ),
  clientObservations: optionalString,
  internalObservations: optionalString,
  benefitPercentage: z.coerce.number().min(0).max(1000).default(30),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  isUrgent: z.coerce.boolean().default(false),
  warehouseId: optionalId,
  manufacturing: z.array(manufacturingLineSchema).default([]),
  materials: z.array(materialLineSchema).default([]),
  extras: z.array(extraLineSchema).default([]),
  installations: z.array(installationLineSchema).default([]),
});

export const quoteRejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "La razon debe tener al menos 3 caracteres")
    .max(2000),
});

export const quoteCancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "La razon debe tener al menos 3 caracteres")
    .max(2000),
});

export const insertTemplateSchema = z.object({
  templateId: requiredString("La plantilla es requerida"),
});

export const reorderItemsSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1))
    .min(1, "Debe indicar al menos un item"),
});
