import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  submitQuote,
  approveQuote,
  rejectQuote,
  returnToDraft,
  cancelQuote,
  sendToProduction,
  insertFromTemplate,
  reorderItems,
  createQuoteRevision,
} from "@/domains/quotes/service";

const ACTIONS = {
  submit: submitQuote,
  approve: approveQuote,
  reject: rejectQuote,
  return: returnToDraft,
  cancel: cancelQuote,
  "send-production": sendToProduction,
  "insert-template": insertFromTemplate,
  reorder: reorderItems,
  revise: createQuoteRevision,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id);
});
