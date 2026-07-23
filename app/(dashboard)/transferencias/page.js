import { requirePagePermission } from "@/lib/auth/guard";
import TransfersClient from "./TransfersClient";

export const metadata = { title: "Transferencias" };

export default async function TransferenciasPage() {
  await requirePagePermission("inventory.transfer");
  return <TransfersClient />;
}
