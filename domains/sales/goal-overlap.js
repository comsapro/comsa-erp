/** Helpers puros de metas de ventas (sin I/O). */

export function goalAssignmentsOverlap(existing, teamIds = [], sellerIds = []) {
  const existingTeams = new Set(
    (existing.teams || []).map((t) => t.teamId || t.team?.id).filter(Boolean)
  );
  const existingSellers = new Set(
    (existing.sellers || []).map((s) => s.sellerId || s.seller?.id).filter(Boolean)
  );
  const teamHit = teamIds.some((id) => existingTeams.has(id));
  const sellerHit = sellerIds.some((id) => existingSellers.has(id));
  return teamHit || sellerHit;
}
