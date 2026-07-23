import { requirePagePermission } from "@/lib/auth/guard";
import InventoryStockClient from "./InventoryStockClient";

export const metadata = { title: "Inventario" };

export default async function InventarioPage() {
  await requirePagePermission("inventory.view");
  return <InventoryStockClient />;
}
