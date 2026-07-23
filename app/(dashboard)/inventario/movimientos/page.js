import { requirePagePermission } from "@/lib/auth/guard";
import MovementsClient from "./MovementsClient";

export const metadata = { title: "Movimientos de inventario" };

export default async function MovimientosPage() {
  await requirePagePermission("inventory.view");
  return <MovementsClient />;
}
