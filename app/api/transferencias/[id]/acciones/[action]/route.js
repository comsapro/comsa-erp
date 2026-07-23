import { withErrorHandling } from "@/lib/api/http";
import {
  submitTransfer,
  approveTransfer,
  completeTransfer,
  cancelTransfer,
} from "@/domains/transfers/service";
import { NotFoundError } from "@/lib/permissions/errors";

const ACTIONS = {
  submit: submitTransfer,
  approve: approveTransfer,
  complete: completeTransfer,
  cancel: cancelTransfer,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) throw new NotFoundError("Accion no encontrada");
  return handler(req, id);
});
