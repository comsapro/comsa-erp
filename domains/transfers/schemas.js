import { z } from "zod";

const transferItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
});

export const transferCreateSchema = z.object({
  sourceWarehouseId: z.string().min(1),
  destinationWarehouseId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(transferItemSchema).min(1, "Agrega al menos un item"),
});

export const transferUpdateSchema = z.object({
  sourceWarehouseId: z.string().min(1).optional(),
  destinationWarehouseId: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(transferItemSchema).min(1).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(1).optional().nullable(),
});
