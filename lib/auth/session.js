import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadUserAuthContext } from "@/lib/auth/user-context";

// Sesion cruda (optimista) desde el JWT.
export const getSession = cache(async () => {
  return auth();
});

// Usuario "vivo" con permisos efectivos, validado contra la BD en cada request
// (chequeo seguro). Memoizado por render con React cache.
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return loadUserAuthContext(userId);
});

// Exige sesion valida; redirige a /login si no existe o el usuario fue
// desactivado/eliminado (sesion invalidada).
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// Verificaciones de permisos en memoria (a partir del usuario ya cargado).
export function userHasPermission(user, code) {
  if (!user) return false;
  return user.permissions.includes(code);
}

export function userHasAnyPermission(user, codes = []) {
  if (!user) return false;
  return codes.some((c) => user.permissions.includes(c));
}
