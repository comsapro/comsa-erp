import { requirePagePermission } from "@/lib/auth/guard";
import PurchaseOrderDetailClient from "./PurchaseOrderDetailClient";

export const metadata = { title: "Detalle orden de compra" };

export default async function OCDetailPage({ params }) {
  await requirePagePermission("purchase_orders.view");
  const { id } = await params;
  return <PurchaseOrderDetailClient id={id} />;
}
