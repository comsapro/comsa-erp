import { requirePagePermission } from "@/lib/auth/guard";
import ReceiptDetailClient from "./ReceiptDetailClient";

export const metadata = { title: "Detalle recepcion" };

export default async function ReceiptDetailPage({ params }) {
  await requirePagePermission("purchase_orders.receive");
  const { id } = await params;
  return <ReceiptDetailClient id={id} />;
}
