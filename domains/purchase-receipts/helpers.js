import { toNumber } from "@/lib/quotes/calculations";
import {
  remainingQuantity,
  resolvePurchaseItemStatus,
  resolvePurchaseOrderStatus,
} from "@/domains/purchase-orders/calculations";

export {
  remainingQuantity,
  resolvePurchaseItemStatus,
  resolvePurchaseOrderStatus,
};

export function toNumberSafe(v) {
  return toNumber(v);
}
