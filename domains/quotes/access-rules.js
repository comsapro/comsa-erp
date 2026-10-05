/** Reglas puras de visibilidad y asignacion de vendedor en cotizaciones. */

function hasPermission(user, code) {
  return Boolean(user?.permissions?.includes(code));
}

function isAdmin(user) {
  return (user?.roles || []).some((role) => role.name === "Administrador");
}

export function canViewAllQuotes(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (hasPermission(user, "quotes.approve")) return true;
  if (hasPermission(user, "sales.view_team")) return true;
  return false;
}

export function canAssignQuoteSeller(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return hasPermission(user, "quotes.approve");
}

/** Búsqueda para vincular OC o factura: no aplica el filtro de equipo del vendedor. */
export function canSearchQuotesForLink(user) {
  if (!user) return false;
  return (
    hasPermission(user, "purchase_orders.create") ||
    hasPermission(user, "sales.create_invoice")
  );
}
