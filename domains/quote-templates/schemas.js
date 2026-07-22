import { z } from "zod";
import {
  requiredString,
  optionalString,
  statusWithDefault,
} from "@/lib/validations/common";
import {
  manufacturingLineSchema,
  materialLineSchema,
  extraLineSchema,
  installationLineSchema,
} from "@/domains/quotes/schemas";

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().min(1).nullable().optional()
);

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().nullable().optional()
);

const DELIVERY_DAYS_TYPES = ["BUSINESS", "CALENDAR"];

export const quoteTemplateCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  category: optionalString,
  description: optionalString,
  defaultQuantity: z.coerce.number().min(0).default(1),
  unit: optionalString,
  deliveryTimeMin: optionalInt,
  deliveryTimeMax: optionalInt,
  deliveryTimeUnit: optionalString,
  deliveryDaysType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(DELIVERY_DAYS_TYPES).nullable().optional()
  ),
  observations: optionalString,
  benefitPercentage: z.coerce.number().min(0).max(1000).default(30),
  itemId: optionalId,
  status: statusWithDefault,
  manufacturing: z.array(manufacturingLineSchema).default([]),
  materials: z.array(materialLineSchema).default([]),
  extras: z.array(extraLineSchema).default([]),
  installations: z.array(installationLineSchema).default([]),
});

export const quoteTemplateUpdateSchema = quoteTemplateCreateSchema.partial();
