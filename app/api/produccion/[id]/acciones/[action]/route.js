import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  startProduction,
  completeOrder,
  cancelProduction,
} from "@/domains/production/service";

const ACTIONS = {
  start: startProduction,
  complete: completeOrder,
  cancel: cancelProduction,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id);
});
