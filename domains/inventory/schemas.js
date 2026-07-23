import { z } from "zod";

const positiveQty = z.coerce.number().positive("Cantidad debe ser mayor a 0");

export const entrySchema = z.object({
  warehouseId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: positiveQty,
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  referenceType: z
    .enum([
      "PURCHASE_ORDER",
      "PRODUCTION_ORDER",
      "PRODUCTION_ITEM",
      "DIRECT_ORDER",
      "MANUAL_ADJUSTMENT",
      "TRANSFER",
      "INITIAL_BALANCE",
    ])
    .optional()
    .nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  movementDate: z.coerce.date().optional(),
});

export const exitSchema = z.object({
  warehouseId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: positiveQty,
  referenceType: z
    .enum([
      "PURCHASE_ORDER",
      "PRODUCTION_ORDER",
      "PRODUCTION_ITEM",
      "DIRECT_ORDER",
      "MANUAL_ADJUSTMENT",
      "TRANSFER",
      "INITIAL_BALANCE",
    ])
    .optional()
    .nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  movementDate: z.coerce.date().optional(),
  productionOrderId: z.string().optional().nullable(),
  productionItemId: z.string().optional().nullable(),
});

export const adjustSchema = z.object({
  warehouseId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: positiveQty,
  direction: z.enum(["IN", "OUT"]),
  reason: z.string().trim().min(1, "Motivo obligatorio"),
  notes: z.string().optional().nullable(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  movementDate: z.coerce.date().optional(),
});

export const reserveSchema = z.object({
  warehouseId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: positiveQty,
  notes: z.string().optional().nullable(),
});
