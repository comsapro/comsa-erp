import { requirePagePermission } from "@/lib/auth/guard";
import ItemsClient from "./ItemsClient";

export const metadata = { title: "Productos e insumos" };

export default async function ItemsPage() {
  await requirePagePermission("items.view");
  return <ItemsClient />;
}
