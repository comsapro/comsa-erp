import { z } from "zod";

const poItemSchema = z
  .object({
    itemId: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.string().min(1).nullable().optional()
    ),
    descriptionSnapshot: z.string().optional().nullable(),
    dimensions: z.string().optional().nullable(),
    presentation: z.string().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    quantity: z.coerce.number().positive(),
    unit: z.string().optional().nullable(),
    unitPrice: z.coerce.number().nonnegative(),
    warehouseId: z.string().optional().nullable(),
    sourceType: z.enum(["QUOTE_MATERIAL", "MANUAL"]).optional(),
    sourceMaterialId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const desc = String(data.descriptionSnapshot || "").trim();
    if (!data.itemId && !desc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica un item de catalogo o una descripcion",
        path: ["descriptionSnapshot"],
      });
    }
  });

export const poCreateSchema = z.object({
  supplierId: z.string().min(1),
  productionOrderId: z.string().min(1, "La orden de produccion es obligatoria"),
  quoteId: z.string().min(1, "La cotizacion es obligatoria"),
  requestDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional().nullable(),
  comments: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1, "Agrega al menos una partida"),
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
