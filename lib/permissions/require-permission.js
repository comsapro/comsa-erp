import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { UnauthorizedError, ForbiddenError } from "@/lib/permissions/errors";

// Chequeo seguro de permiso en el servidor. Revalida contra la BD (via
// getCurrentUser) y lanza 401/403. Debe invocarse en TODA mutacion/lectura
// sensible dentro de Route Handlers y Server Actions.
export async function requirePermission(code) {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!user.permissions.includes(code)) {
    throw new ForbiddenError(
      "No cuentas con permiso para realizar esta accion",
      code
    );
  }
  return user;
}

// Variante que exige al menos uno de varios permisos.
export async function requireAnyPermission(codes = []) {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!codes.some((c) => user.permissions.includes(c))) {
    throw new ForbiddenError("No cuentas con permiso para esta accion");
  }
  return user;
}
