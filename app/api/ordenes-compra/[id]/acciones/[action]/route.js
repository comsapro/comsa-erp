import { withErrorHandling } from "@/lib/api/http";
import {
  submitPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  cancelPurchaseOrder,
} from "@/domains/purchase-orders/service";
import { NotFoundError } from "@/lib/permissions/errors";

const ACTIONS = {
  submit: submitPurchaseOrder,
  approve: approvePurchaseOrder,
  reject: rejectPurchaseOrder,
  cancel: cancelPurchaseOrder,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) throw new NotFoundError("Accion no encontrada");
  return handler(req, id);
});
