import "server-only";
import { redirect } from "next/navigation";
import { requireUser, userHasPermission, userHasAnyPermission } from "@/lib/auth/session";

// Protege una pagina del dashboard. Exige sesion valida y el permiso indicado;
// si falta, redirige a /acceso-denegado. Devuelve el usuario cargado.
export async function requirePagePermission(code) {
  const user = await requireUser();
  if (!userHasPermission(user, code)) {
    redirect("/acceso-denegado");
  }
  return user;
}

export async function requirePageAnyPermission(codes = []) {
  const user = await requireUser();
  if (!userHasAnyPermission(user, codes)) {
    redirect("/acceso-denegado");
  }
  return user;
}
