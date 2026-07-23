import { z } from "zod";

const poItemSchema = z.object({
  itemId: z.string().min(1),
  descriptionSnapshot: z.string().optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative(),
  warehouseId: z.string().optional().nullable(),
});

export const poCreateSchema = z.object({
  supplierId: z.string().min(1),
  productionOrderId: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  requestDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional().nullable(),
  comments: z.string().optional().nullable(),
  items: z.array(poItemSchema).default([]),
});

export const poUpdateSchema = z.object({
  supplierId: z.string().min(1).optional(),
  productionOrderId: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  requestDate: z.coerce.date().optional(),
  expectedDate: z.coerce.date().optional().nullable(),
  comments: z.string().optional().nullable(),
  items: z.array(poItemSchema).optional(),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(1, "Motivo obligatorio"),
});

export const receiptCreateSchema = z.object({
  purchaseOrderId: z.string().min(1),
  warehouseId: z.string().min(1),
  receiptDate: z.coerce.date(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().min(1),
        receivedQuantity: z.coerce.number().positive(),
        unitCost: z.coerce.number().nonnegative().optional(),
      })
    )
    .min(1),
});
