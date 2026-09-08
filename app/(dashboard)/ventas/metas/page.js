import { requirePagePermission } from "@/lib/auth/guard";
import SalesGoalsClient from "./SalesGoalsClient";

export const metadata = { title: "Metas de ventas" };

export default async function MetasVentasPage() {
  await requirePagePermission("sales.manage_goals");
  return <SalesGoalsClient />;
}
