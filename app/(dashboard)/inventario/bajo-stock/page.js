import { requirePagePermission } from "@/lib/auth/guard";
import LowStockClient from "./LowStockClient";

export const metadata = { title: "Stock bajo" };

export default async function BajoStockPage() {
  await requirePagePermission("inventory.view");
  return <LowStockClient />;
}
