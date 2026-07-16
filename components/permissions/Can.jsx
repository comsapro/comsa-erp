"use client";

import { usePermissions } from "./PermissionsProvider";

// Renderiza children solo si el usuario cuenta con el permiso indicado.
// Uso: <Can permission="clients.create"><Button/></Can>
//      <Can anyOf={["clients.edit","clients.delete"]}>...</Can>
export function Can({ permission, anyOf, allOf, fallback = null, children }) {
  const { has, hasAny, hasAll } = usePermissions();

  let allowed = true;
  if (permission) allowed = allowed && has(permission);
  if (anyOf) allowed = allowed && hasAny(anyOf);
  if (allOf) allowed = allowed && hasAll(allOf);

  return allowed ? children : fallback;
}

export default Can;
