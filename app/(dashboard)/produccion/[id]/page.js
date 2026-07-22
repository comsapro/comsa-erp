import { requirePagePermission } from "@/lib/auth/guard";
import ProductionDetailClient from "./ProductionDetailClient";

export const metadata = { title: "Detalle produccion" };

export default async function ProductionDetailPage({ params }) {
  await requirePagePermission("production.view");
  const { id } = await params;
  return <ProductionDetailClient id={id} />;
}
