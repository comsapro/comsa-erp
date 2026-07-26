import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  startItem,
  updateItemProgress,
  completeItem,
  addItemNote,
} from "@/domains/production/service";

const ACTIONS = {
  start: startItem,
  "update-progress": updateItemProgress,
  complete: completeItem,
  "add-note": addItemNote,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id, itemId);
});
