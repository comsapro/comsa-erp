import { z } from "zod";
import {
  INCIDENT_PRIORITIES,
  MANUAL_TRACKING_STATUSES,
  KPI_CATALOG_TYPES,
  SUGGESTED_RESPONSIBLE_OPTIONS,
  KPI_MODULES,
  DETECTION_STAGES,
  CORRECTABLE_INVOICE_FIELDS,
} from "./constants.js";

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().trim().max(4000).nullable().optional()
);

const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().min(1).nullable().optional()
);

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (AAAA-MM-DD)");

const optionalDateKey = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).slice(0, 10)),
  dateKey.nullable().optional()
);

/** Registrar incidencia desde la vista de seguimiento / junta. */
export const meetingIncidentSchema = z.object({
  productionItemId: z.string().min(1, "Selecciona el trabajo"),
  reasonCode: z.string().trim().min(1, "Indica la razon"),
  title: optionalText,
  comment: optionalText,
  assignedToUserId: z.string().min(1, "Selecciona al responsable de dar seguimiento"),
  priority: z.enum(INCIDENT_PRIORITIES).default("MEDIUM"),
  stopsWork: z.boolean().default(true),
});

export const incidentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("attend"), comment: optionalText }),
  z.object({ action: z.literal("comment"), comment: z.string().trim().min(1, "Escribe un comentario") }),
  z.object({ action: z.literal("resolve"), comment: z.string().trim().min(1, "Describe como se resolvio") }),
  z.object({ action: z.literal("close"), comment: optionalText }),
  z.object({ action: z.literal("reopen"), comment: z.string().trim().min(1, "Indica el motivo") }),
  z.object({
    action: z.literal("reassign"),
    assignedToUserId: z.string().min(1, "Selecciona al nuevo responsable"),
    comment: optionalText,
  }),
  z.object({
    action: z.literal("priority"),
    priority: z.enum(INCIDENT_PRIORITIES),
    comment: optionalText,
  }),
]);

export const trackingStatusSchema = z.object({
  status: z.enum([...MANUAL_TRACKING_STATUSES, "AUTO"]),
  deliveredAt: optionalDateKey,
  reason: optionalText,
});

export const catalogEntrySchema = z.object({
  type: z.enum(Object.values(KPI_CATALOG_TYPES)),
  code: z
    .string()
    .trim()
    .min(1, "Codigo requerido")
    .max(40)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9_]+/g, "_")),
  label: z.string().trim().min(1, "Nombre requerido").max(120),
  description: optionalText,
  relatedModules: z.array(z.enum(Object.keys(KPI_MODULES))).default([]),
  suggestedResponsible: z.enum(Object.keys(SUGGESTED_RESPONSIBLE_OPTIONS)).default("NONE"),
  requiredAction: optionalText,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const catalogEntryUpdateSchema = catalogEntrySchema.omit({ type: true, code: true }).partial();

export const kpiSettingsSchema = z.object({
  taxRate: z.coerce.number().min(0).max(100),
  laborHourRate: z.coerce.number().min(0).max(1000000),
  defaultCreditDays: z.coerce.number().int().min(0).max(365),
  upcomingDays: z.coerce.number().int().min(1).max(60),
  dueSoonDays: z.coerce.number().int().min(1).max(60),
});

export const invoiceCorrectionSchema = z
  .object({
    invoiceId: z.string().min(1),
    field: z.enum(Object.keys(CORRECTABLE_INVOICE_FIELDS)),
    value: z.preprocess((v) => (v === "" || v == null ? null : v), z.union([z.string(), z.number()]).nullable()),
    reason: z.string().trim().min(5, "Explica el motivo de la correccion (min. 5 caracteres)"),
  })
  .superRefine((data, ctx) => {
    const def = CORRECTABLE_INVOICE_FIELDS[data.field];
    if (data.value == null) {
      if (data.field === "invoiceDate") {
        ctx.addIssue({ code: "custom", path: ["value"], message: "La fecha de factura es obligatoria" });
      }
      return;
    }
    if (def.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.value))) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Fecha invalida" });
    }
    if (def.type === "int") {
      const n = Number(data.value);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Debe ser un entero entre 0 y 365" });
      }
    }
  });

export const invoicePaymentSchema = z.object({
  paidAt: optionalDateKey,
  paymentNotes: optionalText,
});

const costLineSchema = z
  .object({
    category: z.enum(["LABOR", "MATERIAL", "OTHER"]),
    concept: z.string().trim().min(1),
    hours: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(100000).nullable().optional()),
    hourlyRate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(1000000).nullable().optional()),
    amount: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).max(100000000)),
    notes: optionalText,
  })
  .superRefine((line, ctx) => {
    if (line.category === "LABOR" && !(line.hours > 0) && !(line.amount > 0)) {
      ctx.addIssue({ code: "custom", path: ["hours"], message: "Captura horas o monto" });
    }
    if (line.category !== "LABOR" && !(line.amount > 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Captura el monto" });
    }
  });

export const qualityErrorSchema = z.object({
  productionOrderId: z.string().min(1, "Selecciona la orden de produccion"),
  productionItemId: optionalId,
  detectedAt: dateKey,
  detectionStage: z.enum(DETECTION_STAGES),
  causeCode: optionalId,
  areaCode: optionalId,
  operatorUserId: optionalId,
  operatorName: optionalText,
  description: z.string().trim().min(3, "Describe el error"),
  costs: z.array(costLineSchema).max(50).default([]),
});

export const qualityErrorUpdateSchema = qualityErrorSchema.omit({ productionOrderId: true }).partial();

export const costLineCreateSchema = costLineSchema;
