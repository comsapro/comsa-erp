import "server-only";
import { getCurrentUser, userHasPermission } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/errors";
import { getTeamPeerUserIds } from "@/domains/teams/peers";

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

/** Vendedor: ve lo propio + compañeros de equipo (sin sales.view_team). */
export function isSellerScopedUser(user) {
  if (!user) return false;
  if (!userHasPermission(user, "sales.view")) return false;
  return !canViewTeamSales(user);
}

export async function resolveSalesScope(request, { sellerIdParam } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Sesión requerida");

  const team = canViewTeamSales(user);
  const requested = sellerIdParam || null;

  if (!team) {
    const peerIds = await getTeamPeerUserIds(user.id);
    if (requested && requested !== "all") {
      if (!peerIds.includes(requested)) {
        throw new ForbiddenError("No puedes ver datos de ese vendedor");
      }
      return {
        user,
        sellerId: requested,
        sellerIds: [requested],
        peerIds,
        team: false,
        peerScoped: true,
      };
    }
    return {
      user,
      sellerId: peerIds.length === 1 ? peerIds[0] : null,
      sellerIds: peerIds,
      peerIds,
      team: false,
      peerScoped: true,
    };
  }

  if (requested && requested !== "all") {
    return {
      user,
      sellerId: requested,
      sellerIds: [requested],
      peerIds: null,
      team: true,
      peerScoped: false,
    };
  }

  return {
    user,
    sellerId: null,
    sellerIds: null,
    peerIds: null,
    team: true,
    peerScoped: false,
  };
}

export function sellerWhere(scope) {
  if (scope.sellerIds?.length === 1) return { sellerId: scope.sellerIds[0] };
  if (scope.sellerIds?.length > 1) return { sellerId: { in: scope.sellerIds } };
  return {};
}

/** True si el actor puede operar sobre un sellerId concreto. */
export function canAccessSellerId(scope, sellerId) {
  if (!sellerId) return false;
  if (scope.team && !scope.peerScoped) return true;
  if (scope.sellerIds?.includes(sellerId)) return true;
  if (scope.peerIds?.includes(sellerId)) return true;
  return scope.user?.id === sellerId;
}
