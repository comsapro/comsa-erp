import { requirePagePermission } from "@/lib/auth/guard";
import DirectOrdersClient from "./DirectOrdersClient";

export const metadata = { title: "Ordenes directas" };

export default async function DirectOrdersPage() {
  await requirePagePermission("direct_orders.view");
  return <DirectOrdersClient />;
}
