import { requirePagePermission } from "@/lib/auth/guard";
import PurchaseOrderFormClient from "./PurchaseOrderFormClient";

export const metadata = { title: "Nueva orden de compra" };

export default async function NuevaOCPage({ searchParams }) {
  await requirePagePermission("purchase_orders.create");
  const sp = await searchParams;
  return (
    <PurchaseOrderFormClient
      productionOrderId={sp?.productionOrderId || ""}
      quoteId={sp?.quoteId || ""}
      itemId={sp?.itemId || ""}
    />
  );
}
