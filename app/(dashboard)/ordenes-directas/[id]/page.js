import { requirePagePermission } from "@/lib/auth/guard";
import DirectOrderDetailClient from "./DirectOrderDetailClient";

export const metadata = { title: "Detalle orden directa" };

export default async function DirectOrderDetailPage({ params }) {
  await requirePagePermission("direct_orders.view");
  const { id } = await params;
  return <DirectOrderDetailClient id={id} />;
}
