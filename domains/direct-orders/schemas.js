import { z } from "zod";
import { requiredString, optionalString } from "@/lib/validations/common";
import { ORDER_TYPES } from "./constants";

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().min(1).nullable().optional()
);

export const directOrderCreateSchema = z.object({
  orderType: z.enum(ORDER_TYPES).default("GENERAL"),
  clientId: requiredString("El cliente es requerido"),
  clientContactId: optionalId,
  sellerId: optionalId,
  issuingCompanyId: requiredString("La empresa emisora es requerida"),
  requestDate: z.coerce.date({ message: "Fecha de solicitud invalida" }),
  validUntil: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.date().nullable().optional()
  ),
  requisition: optionalString,
  observations: optionalString,
});

export const directOrderUpdateSchema = directOrderCreateSchema.partial();

export const directOrderItemUpsertSchema = z.object({
  id: optionalId,
  itemId: optionalId,
  description: requiredString("La descripcion del item es requerida", 2000),
  quantity: z.coerce.number().min(0.001, "La cantidad debe ser mayor a 0"),
  unit: optionalString,
  observations: optionalString,
  benefitPercentage: z.coerce.number().min(0).max(1000).default(30),
});

export const directOrderRejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "La razon debe tener al menos 3 caracteres")
    .max(2000),
});

export const directOrderCancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "La razon debe tener al menos 3 caracteres")
    .max(2000),
});
