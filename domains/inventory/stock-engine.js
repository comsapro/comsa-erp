import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { generateFolio } from "@/lib/folios";
import { ValidationError } from "@/lib/permissions/errors";
import { toNumber } from "@/lib/quotes/calculations";
import { applyStockChange } from "./stock-math";

export {
  applyStockChange,
  computeStockDelta,
  isLowStock,
  QTY_INCREASE_TYPES,
  QTY_DECREASE_TYPES,
  RESERVE_TYPES,
  RELEASE_TYPES,
} from "./stock-math";

/**
 * Bloquea (o crea) la fila de stock y aplica el movimiento dentro de `tx`.
 * Debe llamarse dentro de prisma.$transaction.
 */
export async function postMovement(tx, input) {
  const {
    warehouseId,
    destinationWarehouseId = null,
    itemId,
    movementType,
    quantity,
    unitCost = null,
    referenceType = null,
    referenceId = null,
    reason = null,
    notes = null,
    movementDate = new Date(),
    createdBy,
  } = input;

  if (!warehouseId || !itemId || !createdBy) {
    throw new ValidationError("Almacen, item y usuario son obligatorios");
  }

  if (
    (movementType === "ADJUSTMENT_IN" || movementType === "ADJUSTMENT_OUT") &&
    !(reason && String(reason).trim())
  ) {
    throw new ValidationError("Los ajustes requieren un motivo obligatorio", {
      reason: ["Motivo obligatorio"],
    });
  }

  const stockId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO inventory_stock (id, warehouse_id, item_id, quantity, reserved_quantity, available_quantity, updated_at)
    VALUES (${stockId}, ${warehouseId}, ${itemId}, 0, 0, 0, NOW())
    ON CONFLICT (warehouse_id, item_id) DO NOTHING
  `;

  const locked = await tx.$queryRaw`
    SELECT id, quantity, reserved_quantity, available_quantity
    FROM inventory_stock
    WHERE warehouse_id = ${warehouseId} AND item_id = ${itemId}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw new ValidationError("No se pudo bloquear el registro de stock");
  }

  const next = applyStockChange(
    {
      quantity: row.quantity,
      reservedQuantity: row.reserved_quantity,
    },
    movementType,
    quantity
  );

  await tx.inventoryStock.update({
    where: { id: row.id },
    data: {
      quantity: new Prisma.Decimal(next.quantity),
      reservedQuantity: new Prisma.Decimal(next.reservedQuantity),
      availableQuantity: new Prisma.Decimal(next.availableQuantity),
    },
  });

  const folio = await generateFolio(tx, "INVENTORY_MOVEMENT", movementDate);

  const movement = await tx.inventoryMovement.create({
    data: {
      folio,
      warehouseId,
      destinationWarehouseId,
      itemId,
      movementType,
      quantity: new Prisma.Decimal(toNumber(quantity)),
      unitCost:
        unitCost == null ? null : new Prisma.Decimal(toNumber(unitCost)),
      referenceType,
      referenceId,
      reason,
      notes,
      movementDate,
      createdBy,
    },
  });

  return { movement, stock: next };
}
