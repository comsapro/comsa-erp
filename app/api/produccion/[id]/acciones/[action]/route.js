import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  startProduction,
  completeOrder,
  cancelProduction,
  markMaterialsReady,
  reprintSheet,
  reprintNewOrder,
} from "@/domains/production/service";

const ACTIONS = {
  start: startProduction,
  complete: completeOrder,
  cancel: cancelProduction,
  "materials-ready": markMaterialsReady,
  "reprint-sheet": reprintSheet,
  "reprint-new-order": reprintNewOrder,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id);
});
