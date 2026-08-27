import { z } from "zod";
// Ruta relativa: los tests con node --test no resuelven el alias "@/".
import { optionalString } from "../../lib/validations/common.js";
import { PRODUCTION_REOPEN_REASON_CODES } from "./constants.js";

export const updateItemProgressSchema = z.object({
  completedQuantity: z.coerce.number().min(0),
  observations: optionalString,
});

export const productionNoteSchema = z.object({
  body: z.string().trim().min(1, "La nota es requerida"),
});

export const reprintSchema = z.object({
  reason: z.string().trim().optional().nullable(),
  itemIds: z.array(z.string()).optional(),
});

// El motivo se elige del catalogo; la nota libre solo es obligatoria cuando es "Otro".
const reopenReasonShape = {
  reasonCode: z.enum(PRODUCTION_REOPEN_REASON_CODES, {
    message: "Selecciona el motivo del catalogo",
  }),
  reason: z.string().trim().max(500).optional().default(""),
};

function requireNoteForOther(data, ctx) {
  if (data.reasonCode === "OTRO" && String(data.reason || "").trim().length < 8) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Describe el motivo (min. 8 caracteres)",
    });
  }
}

export const reopenItemSchema = z.object(reopenReasonShape).superRefine(requireNoteForOther);

export const uncompleteItemSchema = z.object(reopenReasonShape).superRefine(requireNoteForOther);

export const createProcessSchema = z.object({
  manufacturingProcessId: z.string().min(1, "Selecciona un proceso del catalogo"),
  expectedHours: z.coerce.number().min(0).optional(),
  notes: optionalString,
});

export const updateProcessHoursSchema = z.object({
  realHours: z.coerce.number().min(0),
  expectedHours: z.coerce.number().min(0).optional(),
  notes: optionalString,
});

export const replaceProcessSchema = z.object({
  manufacturingProcessId: z.string().min(1, "Selecciona el proceso de reemplazo"),
  reason: z.string().trim().min(8, "Indica el motivo del reemplazo"),
  expectedHours: z.coerce.number().min(0).optional(),
});

export const assignProcessSchema = z.object({
  assignedToUserId: z.string().min(1).nullable().optional(),
});

const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.date().nullable().optional()
);

export const updateItemPlanningSchema = z.object({
  assignedToUserId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  plannedStartAt: optionalDate,
  plannedEndAt: optionalDate,
  commitmentDate: optionalDate,
  reason: optionalString,
});

export const updateOrderPlanningSchema = z.object({
  estimatedDeliveryDate: optionalDate,
  reason: optionalString,
});

export const handicapSchema = z.object({
  handicapPercent: z.coerce.number().min(0).max(90),
  applyToPending: z.coerce.boolean().optional().default(true),
});

export const createIncidentSchema = z.object({
  productionItemId: z.string().optional().nullable(),
  processId: z.string().optional().nullable(),
  type: z
    .enum([
      "ORDER",
      "ITEM",
      "PROCESS",
      "MATERIAL",
      "MACHINERY",
      "DOCUMENTATION",
      "OTHER",
    ])
    .default("OTHER"),
  title: z.string().trim().min(3, "El titulo es requerido"),
  description: z.string().trim().min(3, "La descripcion es requerida"),
  blocking: z.coerce.boolean().optional().default(false),
  assignedToUserId: z.string().optional().nullable(),
});

export const updateIncidentSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  actionTaken: optionalString,
  blocking: z.coerce.boolean().optional(),
  assignedToUserId: z.string().optional().nullable(),
  description: optionalString,
});

export const extraMaterialSchema = z.object({
  productionItemId: z.string().optional().nullable(),
  processId: z.string().optional().nullable(),
  catalogItemId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  description: z.string().trim().min(2, "La descripcion es requerida"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unit: optionalString,
  unitCost: z.coerce.number().min(0).optional().nullable(),
  reason: z.string().trim().min(3, "El motivo es requerido"),
});

export const sessionActionSchema = z.object({
  note: optionalString,
});

