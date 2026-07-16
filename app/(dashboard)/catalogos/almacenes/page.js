import { requirePagePermission } from "@/lib/auth/guard";
import WarehousesClient from "./WarehousesClient";

export const metadata = { title: "Almacenes" };

export default async function WarehousesPage() {
  await requirePagePermission("warehouses.view");
  return <WarehousesClient />;
}
