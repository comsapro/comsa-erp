import { requirePagePermission } from "@/lib/auth/guard";
import PurchaseOrdersClient from "./PurchaseOrdersClient";

export const metadata = { title: "Ordenes de compra" };

export default async function OrdenesCompraPage() {
  await requirePagePermission("purchase_orders.view");
  return <PurchaseOrdersClient />;
}
