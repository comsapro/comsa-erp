import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission } from "@/lib/auth/session";
import SalesGoalsClient from "./SalesGoalsClient";

export const metadata = { title: "Metas de ventas" };

export default async function MetasVentasPage() {
  const user = await requirePagePermission("sales.view");
  return (
    <SalesGoalsClient canManage={userHasPermission(user, "sales.manage_goals")} />
  );
}
