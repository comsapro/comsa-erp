import "server-only";
import { getCurrentUser, userHasPermission } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/errors";

/** Usuario de ventas puro: ve dashboard comercial, no el home admin. */
export function isSalesHomeUser(user) {
  if (!user) return false;
  if (!userHasPermission(user, "sales.view")) return false;
  return !userHasPermission(user, "users.view");
}

export function canViewTeamSales(user) {
  return userHasPermission(user, "sales.view_team");
}

export function canManageSalesGoals(user) {
  return userHasPermission(user, "sales.manage_goals");
}

export async function resolveSalesScope(request, { sellerIdParam } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Sesión requerida");

  const team = canViewTeamSales(user);
  const requested = sellerIdParam || null;

  if (!team) {
    return {
      user,
      sellerId: user.id,
      sellerIds: [user.id],
      team: false,
    };
  }

  if (requested && requested !== "all") {
    return {
      user,
      sellerId: requested,
      sellerIds: [requested],
      team: true,
    };
  }

  return {
    user,
    sellerId: null,
    sellerIds: null,
    team: true,
  };
}

export function sellerWhere(scope) {
  if (scope.sellerIds?.length === 1) return { sellerId: scope.sellerIds[0] };
  if (scope.sellerIds?.length > 1) return { sellerId: { in: scope.sellerIds } };
  return {};
}
