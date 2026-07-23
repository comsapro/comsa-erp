import { requirePagePermission } from "@/lib/auth/guard";
import TransferDetailClient from "./TransferDetailClient";

export const metadata = { title: "Detalle transferencia" };

export default async function TransferDetailPage({ params }) {
  await requirePagePermission("inventory.transfer");
  const { id } = await params;
  return <TransferDetailClient id={id} />;
}
