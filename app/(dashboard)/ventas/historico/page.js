import { requirePageAnyPermission } from "@/lib/auth/guard";
import { userHasAnyPermission } from "@/lib/auth/session";
import SalesHistoryClient from "./SalesHistoryClient";

export const metadata = { title: "Histórico de ventas" };

export default async function SalesHistoryPage() {
  const user = await requirePageAnyPermission(["kpis.view", "sales.view_team"]);
  return <SalesHistoryClient canLink={userHasAnyPermission(user, ["sales.edit_invoice", "kpis.correct_data"])} />;
}
