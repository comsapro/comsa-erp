import { z } from "zod";
import { MATERIAL_SKIP_REASONS, SALES_GOAL_PERIODS } from "./constants.js";

export const salesCalendarEventSchema = z.object({
  title: z.string().trim().min(1, "El titulo es requerido"),
  eventDate: z.coerce.date(),
  type: z.enum(["DELIVERY", "VACATION", "OTHER"]).default("OTHER"),
  notes: z.string().trim().optional().nullable(),
  teamId: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().min(1).nullable().optional()
  ),
});

export const salesGoalSchema = z
  .object({
    period: z.enum([
      SALES_GOAL_PERIODS.MONTHLY,
      SALES_GOAL_PERIODS.QUARTERLY,
      SALES_GOAL_PERIODS.SEMIANNUAL,
      SALES_GOAL_PERIODS.ANNUAL,
    ]),
    periodKey: z.string().trim().min(4),
    amount: z.preprocess(
      (v) => {
        if (typeof v === "string") {
          const cleaned = v.replace(/\$/g, "").replace(/,/g, "").trim();
          return cleaned === "" ? v : cleaned;
        }
        return v;
      },
      z.coerce.number().positive("La meta debe ser mayor a 0")
    ),
    label: z.string().trim().optional().nullable(),
    amountIncludesTax: z.boolean().default(true),
    sellerIds: z.array(z.string().min(1)).default([]),
    teamIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.sellerIds.length && !data.teamIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona al menos un equipo o un vendedor",
        path: ["teamIds"],
      });
    }
  });

const invoiceQuoteSchema = z.object({
  quoteId: z.string().min(1),
  quoteItemIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una partida"),
});

export const salesInvoiceSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1, "Número de factura obligatorio"),
    netAmount: z.coerce.number().positive("Monto neto obligatorio"),
    invoiceDate: z.coerce.date(),
    sellerId: z.string().optional().nullable(),
    clientPoNumber: z.string().trim().min(1, "Número de PO obligatorio"),
    receivedByClient: z.boolean(),
    receptionDate: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.date().nullable().optional()
    ),
    notes: z.string().optional().nullable(),
    // Dashboard gerencial: envio al cliente, dias de credito y pago.
    sentAt: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.date().nullable().optional()
    ),
    creditDays: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().int("Dias enteros").min(0).max(365).nullable().optional()
    ),
    paidAt: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.date().nullable().optional()
    ),
    // Vacío solo permitido para Administrador (validado en servicio).
    quotes: z.array(invoiceQuoteSchema).default([]),
    // Equipo al que se acredita (suma a la meta de todos sus integrantes).
    teamId: z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional()),
    // Sin cotizacion: cliente, descripcion y motivo (catalogo) obligatorios.
    clientId: z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional()),
    description: z.string().trim().max(2000).optional().nullable(),
    noQuoteReasonCode: z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional()),
  })
  .superRefine((data, ctx) => {
    if (!data.quotes?.length) {
      if (!data.clientId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona el cliente", path: ["clientId"] });
      }
      if (!data.description?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Describe lo facturado", path: ["description"] });
      }
      if (!data.noQuoteReasonCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indica el motivo de no ligar cotización",
          path: ["noQuoteReasonCode"],
        });
      }
    }
    if (data.receivedByClient && !data.receptionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de recepción es obligatoria",
        path: ["receptionDate"],
      });
    }
    if (data.paidAt && !data.receivedByClient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Registra primero la recepción del cliente",
        path: ["paidAt"],
      });
    }
  });

export const salesInvoiceUpdateSchema = salesInvoiceSchema;

export const salesInvoiceReceptionSchema = z
  .object({
    receivedByClient: z.boolean(),
    receptionDate: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.date().nullable().optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (data.receivedByClient && !data.receptionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de recepción es obligatoria",
        path: ["receptionDate"],
      });
    }
  });

export const materialDecisionSchema = z
  .object({
    quoteItemMaterialId: z.string().min(1),
    willPurchase: z.boolean(),
    skipReason: z
      .enum([
        MATERIAL_SKIP_REASONS.IN_STOCK,
        MATERIAL_SKIP_REASONS.CLIENT_PROVIDED,
        MATERIAL_SKIP_REASONS.USE_SURPLUS,
        MATERIAL_SKIP_REASONS.NOT_APPLICABLE,
        MATERIAL_SKIP_REASONS.OTHER,
      ])
      .optional()
      .nullable(),
    observations: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.willPurchase && !data.skipReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica la razón por la cual no se comprará",
        path: ["skipReason"],
      });
    }
  });

export const commitmentDateSchema = z.object({
  commitmentDate: z.coerce.date(),
  reason: z.string().trim().optional().nullable(),
});
