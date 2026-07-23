import { requirePagePermission } from "@/lib/auth/guard";
import MovementDetailClient from "./MovementDetailClient";

export const metadata = { title: "Detalle de movimiento" };

export default async function MovementDetailPage({ params }) {
  await requirePagePermission("inventory.view");
  const { id } = await params;
  return <MovementDetailClient id={id} />;
}
