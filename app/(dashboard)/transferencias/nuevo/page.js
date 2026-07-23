import { requirePagePermission } from "@/lib/auth/guard";
import TransferFormClient from "./TransferFormClient";

export const metadata = { title: "Nueva transferencia" };

export default async function NuevaTransferenciaPage() {
  await requirePagePermission("inventory.transfer");
  return <TransferFormClient />;
}
