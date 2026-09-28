import { requirePagePermission } from "@/lib/auth/guard";
import HistoryClient from "./HistoryClient";

export const metadata = { title: "Historial Calidad — Proyecto" };

export default async function HistorialOrderPage({ params }) {
  await requirePagePermission("quality.view_history");
  const { orderId } = await params;
  return <HistoryClient orderId={orderId} />;
}
