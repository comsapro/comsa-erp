import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission } from "@/lib/auth/session";
import SalesDashboardClient from "./SalesDashboardClient";

export const metadata = { title: "Dashboard de ventas" };

export default async function VentasDashboardPage() {
  const user = await requirePagePermission("sales.view");
  return (
    <SalesDashboardClient
      canManageGoals={userHasPermission(user, "sales.manage_goals")}
      canCreateInvoice={userHasPermission(user, "sales.create_invoice")}
      canViewTeam={userHasPermission(user, "sales.view_team")}
      currentUserId={user.id}
    />
  );
}
