import { requirePagePermission } from "@/lib/auth/guard";
import MovementFormClient from "../MovementFormClient";

export const metadata = { title: "Entrada de inventario" };

export default async function EntradaPage() {
  await requirePagePermission("inventory.create_entry");
  return <MovementFormClient mode="entrada" />;
}
