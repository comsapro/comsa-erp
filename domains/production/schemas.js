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
