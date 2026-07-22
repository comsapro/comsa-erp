import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  submitDirectOrder,
  approveDirectOrder,
  rejectDirectOrder,
  returnDirectOrderToDraft,
  cancelDirectOrder,
  convertToQuote,
  sendDirectOrderToProduction,
} from "@/domains/direct-orders/service";

const ACTIONS = {
  submit: submitDirectOrder,
  approve: approveDirectOrder,
  reject: rejectDirectOrder,
  return: returnDirectOrderToDraft,
  cancel: cancelDirectOrder,
  "convert-to-quote": convertToQuote,
  "send-production": sendDirectOrderToProduction,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id);
});
