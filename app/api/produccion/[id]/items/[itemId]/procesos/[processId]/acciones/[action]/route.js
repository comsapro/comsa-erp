import { withErrorHandling } from "@/lib/api/http";
import { ValidationError } from "@/lib/permissions/errors";
import {
  completeProcess,
  replaceProcess,
} from "@/domains/production/processes";
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
} from "@/domains/production/sessions";
import { assignProcessResponsible } from "@/domains/production/planning";

const ACTIONS = {
  completar: completeProcess,
  reemplazar: replaceProcess,
  "iniciar-sesion": startSession,
  pausar: pauseSession,
  reanudar: resumeSession,
  "finalizar-sesion": endSession,
  asignar: assignProcessResponsible,
};

export const POST = withErrorHandling(async (req, ctx) => {
  const { id, itemId, processId, action } = await ctx.params;
  const handler = ACTIONS[action];
  if (!handler) {
    throw new ValidationError(`Accion no soportada: ${action}`);
  }
  return handler(req, id, itemId, processId);
});
