import { requirePagePermission } from "@/lib/auth/guard";
import MovementFormClient from "../MovementFormClient";

export const metadata = { title: "Ajuste de inventario" };

export default async function AjustePage() {
  await requirePagePermission("inventory.adjust");
  return <MovementFormClient mode="ajuste" />;
}
