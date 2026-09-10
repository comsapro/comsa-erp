import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission, userIsAdmin } from "@/lib/auth/session";
import SalesInvoiceFormClient from "./SalesInvoiceFormClient";

export const metadata = { title: "Nueva factura de ventas" };

export default async function NuevaFacturaVentasPage() {
  const user = await requirePagePermission("sales.create_invoice");
  return (
    <SalesInvoiceFormClient
      canViewTeam={userHasPermission(user, "sales.view_team")}
      isAdmin={userIsAdmin(user)}
      currentUserId={user.id}
      currentUserName={user.name}
    />
  );
}
