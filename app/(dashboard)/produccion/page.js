import { requirePagePermission } from "@/lib/auth/guard";
import ProductionClient from "./ProductionClient";

export const metadata = { title: "Produccion" };

export default async function ProductionPage() {
  await requirePagePermission("production.view");
  return <ProductionClient />;
}
