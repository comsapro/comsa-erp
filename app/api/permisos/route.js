import { withErrorHandling, jsonOk } from "@/lib/api/http";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { MODULES, ACTION_LABELS } from "@/lib/permissions/catalog";

// Catalogo de permisos agrupado por modulo (para el editor de roles).
export const GET = withErrorHandling(async () => {
  await requireAnyPermission(["roles.view", "roles.edit", "roles.create"]);

  const groups = MODULES.map((mod) => ({
    module: mod.key,
    label: mod.label,
    permissions: mod.actions.map((action) => ({
      code: `${mod.key}.${action}`,
      action,
      actionLabel: ACTION_LABELS[action] || action,
    })),
  }));

  return jsonOk({ modules: groups });
});
