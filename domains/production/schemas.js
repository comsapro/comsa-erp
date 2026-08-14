import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

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

export const reopenItemSchema = z.object({
  reason: z.string().trim().min(8, "Indica el motivo de la reapertura (min. 8 caracteres)"),
});

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
