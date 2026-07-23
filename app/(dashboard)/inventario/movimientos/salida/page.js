import { requirePagePermission } from "@/lib/auth/guard";
import MovementFormClient from "../MovementFormClient";

export const metadata = { title: "Salida de inventario" };

export default async function SalidaPage() {
  await requirePagePermission("inventory.create_exit");
  return <MovementFormClient mode="salida" />;
}
